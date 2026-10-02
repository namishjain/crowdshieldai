from __future__ import annotations

import logging
import os
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Callable

import cv2
import numpy as np

from backend.app.metrics.engine import CameraMetrics

log = logging.getLogger("crowdshield.cv")


class VideoManager:
    """One reusable inference pipeline, configured as six independent camera workers."""

    def __init__(self, config: dict[str, Any], root: Path, on_update: Callable[[str, dict[str, Any]], None],
                 on_system: Callable[..., None] | None = None):
        self.config = config
        self.root = root
        self.on_update = on_update
        self.on_system = on_system or (lambda **_: None)
        self.stop_event = threading.Event()
        self.supervisor: threading.Thread | None = None
        self.workers: list[threading.Thread] = []
        self.inference_slots = threading.Semaphore(3)
        self.feed_lock = threading.RLock()
        self.feed_generation = 0
        self.active_video_set = "original"
        self._camera_specs = config["cameras"]
        self._gpu_name = "CPU"

    def select_video_set(self, set_id: str, relative_root: str) -> bool:
        """Point all running camera workers at a packaged six-video set."""
        video_root = self.root / relative_root
        missing = [spec["id"] for spec in self._camera_specs
                   if not (video_root / f"{spec['id']}.mp4").is_file()]
        if missing:
            raise FileNotFoundError(f"Video set {set_id} is missing: {', '.join(missing)}")
        with self.feed_lock:
            if self.active_video_set == set_id and self.config["video"]["root"] == relative_root:
                return False
            self.config["video"]["root"] = relative_root
            self.active_video_set = set_id
            self.feed_generation += 1
        return True

    def start(self) -> None:
        self.supervisor = threading.Thread(target=self._load_and_start, name="camera-supervisor", daemon=True)
        self.supervisor.start()

    def stop(self) -> None:
        self.stop_event.set()
        for worker in self.workers:
            worker.join(timeout=3)
        if self.supervisor:
            self.supervisor.join(timeout=3)

    def _load_and_start(self) -> None:
        weights = (self.root / self.config["model"]["weights"]).resolve()
        if not weights.is_file():
            message = f"Model weights missing: {weights}. Run scripts/setup_model.py first."
            for spec in self._camera_specs:
                self.on_update(spec["id"], {"status": "MODEL_MISSING", "message": message})
            self.on_system(device="unavailable", backend_status="model missing")
            log.error(message)
            return
        try:
            local_config_dir = self.root / "work" / "ultralytics"
            local_config_dir.mkdir(parents=True, exist_ok=True)
            os.environ.setdefault("YOLO_CONFIG_DIR", str(local_config_dir))
            import torch
            from ultralytics import YOLO

            cuda = torch.cuda.is_available()
            device = self.config["model"].get("device", "auto")
            if device == "auto":
                device = "0" if cuda else "cpu"
            if device != "cpu" and not cuda:
                log.warning("Configured accelerator %s is unavailable; falling back to CPU", device)
                device = "cpu"
            self._gpu_name = torch.cuda.get_device_name(0) if device != "cpu" else "CPU"
            if device == "cpu":
                torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
            log.info("[CV] YOLOv8n loaded on %s; six configured camera feeds", self._gpu_name)
            self.on_system(device=self._gpu_name, backend_status="loading six camera predictors")
        except Exception as exc:
            message = f"Could not initialize PyTorch/Ultralytics: {exc}"
            for spec in self._camera_specs:
                self.on_update(spec["id"], {"status": "MODEL_ERROR", "message": message})
            self.on_system(device="unavailable", backend_status="model initialization failed")
            log.exception(message)
            return

        ready: list[tuple[dict[str, Any], Path, Any, int]] = []
        with self.feed_lock:
            selected_root = str(self.config["video"]["root"])
            generation = self.feed_generation
        for spec in self._camera_specs:
            if self.stop_event.is_set():
                return
            video = self.root / selected_root / f"{spec['id']}.mp4"
            if not video.is_file():
                self.on_update(spec["id"], {"status": "MISSING_VIDEO", "message": f"Video not found: {video.relative_to(self.root)}"})
                continue
            self.on_update(spec["id"], {"status": "LOADING_MODEL", "message": None})
            try:
                # Independent YOLO predictor per view gives every camera its own persistent ByteTrack tracker.
                model = YOLO(str(weights))
                ready.append((spec, video, model, generation))
                log.info("[CV] %s initialized from %s", spec["id"], video.relative_to(self.root))
            except Exception as exc:
                message = f"Could not initialize {spec['id']}: {exc}"
                self.on_update(spec["id"], {"status": "CAMERA_ERROR", "message": message})
                log.exception(message)
        for spec, video, model, generation in ready:
            if self.stop_event.is_set():
                return
            worker = threading.Thread(target=self._run_camera, args=(spec, video, model, device, generation),
                                      name=f"{spec['id']}-processor", daemon=True)
            self.workers.append(worker)
            worker.start()
        self.on_system(device=self._gpu_name, backend_status=f"processing {len(ready)}/{len(self._camera_specs)} video views")

    def _run_camera(self, spec: dict[str, Any], video: Path, model: Any, device: str,
                    active_generation: int) -> None:
        camera_id = spec["id"]
        cap = cv2.VideoCapture(str(video))
        if not cap.isOpened():
            self.on_update(camera_id, {"status": "VIDEO_ERROR", "message": f"OpenCV could not open {video.name}; check codec/asset."})
            return
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 10.0
        duration = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) / max(1.0, fps)
        metric_engine = CameraMetrics(camera_id, spec["line"], spec.get("direction_positive", "IN"))
        interval = max(0.25, float(self.config["model"]["inference_interval_seconds"]))
        next_video_time = 0.0
        loop_count = 0
        recent_latencies: deque[float] = deque(maxlen=30)
        recent_rates: deque[float] = deque(maxlen=30)
        last_inference_wall = time.perf_counter()
        self.on_update(camera_id, {"status": "LIVE", "video_time_seconds": 0.0, "message": None,
                                   "source_fps": fps, "source_duration_seconds": duration})
        try:
            while not self.stop_event.is_set():
                with self.feed_lock:
                    generation = self.feed_generation
                    selected_root = str(self.config["video"]["root"])
                    selected_set = self.active_video_set
                if generation != active_generation:
                    cap.release()
                    video = self.root / selected_root / f"{camera_id}.mp4"
                    cap = cv2.VideoCapture(str(video))
                    active_generation = generation
                    if not cap.isOpened():
                        self.on_update(camera_id, {"status": "VIDEO_ERROR",
                            "message": f"OpenCV could not open {video.name}; check codec/asset."})
                        return
                    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 10.0
                    duration = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) / max(1.0, fps)
                    metric_engine = CameraMetrics(camera_id, spec["line"], spec.get("direction_positive", "IN"))
                    next_video_time = 0.0
                    loop_count = 0
                    try:
                        trackers = getattr(getattr(model, "predictor", None), "trackers", None)
                        if trackers:
                            for tracker in trackers:
                                tracker.reset()
                    except Exception:
                        pass
                    self.on_update(camera_id, {"status": "LIVE", "video_time_seconds": 0.0,
                        "message": f"Switched to {selected_set} sample feed", "source_fps": fps,
                        "source_duration_seconds": duration})
                ok, frame = cap.read()
                if not ok:
                    if not self.config["video"].get("browser_loop", True):
                        self.on_update(camera_id, {"status": "ENDED", "video_time_seconds": duration})
                        break
                    loop_count += 1
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    metric_engine = CameraMetrics(camera_id, spec["line"], spec.get("direction_positive", "IN"))
                    next_video_time = 0.0
                    try:
                        trackers = getattr(getattr(model, "predictor", None), "trackers", None)
                        if trackers:
                            for tracker in trackers:
                                tracker.reset()
                    except Exception:
                        pass
                    self.on_update(camera_id, {"status": "LIVE", "video_time_seconds": 0.0,
                                               "loop_count": loop_count, "message": "DEMO LOOP"})
                    continue
                video_time = max(0.0, float(cap.get(cv2.CAP_PROP_POS_MSEC)) / 1000.0)
                if video_time + 0.01 < next_video_time:
                    continue
                next_video_time = video_time + interval
                begin = time.perf_counter()
                with self.inference_slots:
                    result = model.track(
                        frame,
                        persist=True,
                        tracker=self.config["model"]["tracker"],
                        classes=[int(self.config["model"]["person_class_id"])],
                        conf=float(self.config["model"]["confidence"]),
                        iou=float(self.config["model"]["iou"]),
                        imgsz=int(self.config["model"]["image_size"]),
                        device=device,
                        verbose=False,
                    )[0]
                latency = (time.perf_counter() - begin) * 1000.0
                boxes = result.boxes
                detections: list[dict[str, Any]] = []
                if boxes is not None and boxes.id is not None:
                    ids = boxes.id.int().cpu().tolist()
                    coordinates = boxes.xyxy.cpu().tolist()
                    detections = [{"track_id": track_id, "bbox": box} for track_id, box in zip(ids, coordinates)]
                frame_height, frame_width = frame.shape[:2]
                polygon = spec.get("roi_polygon", [[0, 0], [1, 0], [1, 1], [0, 1]])
                roi = np.asarray(
                    [[round(float(x) * frame_width), round(float(y) * frame_height)] for x, y in polygon],
                    dtype=np.int32,
                )
                detections = [
                    item for item in detections
                    if cv2.pointPolygonTest(roi,
                        ((item["bbox"][0] + item["bbox"][2]) / 2, (item["bbox"][1] + item["bbox"][3]) / 2),
                        False) >= 0
                ]
                measured = metric_engine.update(detections, video_time, frame_width, frame_height)
                now = time.perf_counter()
                recent_latencies.append(latency)
                elapsed = now - last_inference_wall
                if elapsed > 0:
                    recent_rates.append(1.0 / elapsed)
                last_inference_wall = now
                measured.update({
                    "status": "LIVE",
                    "processing_fps": round(sum(recent_rates) / max(1, len(recent_rates)), 2),
                    "inference_latency_ms": round(sum(recent_latencies) / max(1, len(recent_latencies)), 1),
                    "loop_count": loop_count,
                    "source_fps": fps,
                    "source_duration_seconds": duration,
                })
                self.on_update(camera_id, measured)
                # Sample/decision cadence follows the video timeline. Inference may lag; timestamps expose that honestly.
                wait_for = interval - (time.perf_counter() - begin)
                if wait_for > 0:
                    self.stop_event.wait(min(wait_for, 1.0))
        except Exception as exc:
            message = f"Processing failed for {camera_id}: {exc}"
            self.on_update(camera_id, {"status": "PROCESSING_ERROR", "message": message})
            log.exception(message)
        finally:
            cap.release()
