from __future__ import annotations

import sys
import time
import os
from pathlib import Path

import cv2
import torch
import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "work" / "ultralytics"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("YOLO_CONFIG_DIR", str(CONFIG_DIR))
from ultralytics import YOLO
sys.path.insert(0, str(ROOT))

from backend.app.metrics.engine import CameraMetrics  # noqa: E402
from backend.app.state import StateService  # noqa: E402


def main() -> int:
    camera_config = yaml.safe_load((ROOT / "configs" / "cameras.yaml").read_text(encoding="utf-8"))
    weights = ROOT / camera_config["model"]["weights"]
    if not weights.is_file():
        raise FileNotFoundError(f"Model missing: {weights}; run scripts/setup_model.py")
    device = "0" if torch.cuda.is_available() else "cpu"
    print(f"End-to-end CV smoke: YOLOv8n + ByteTrack on {device}; six configured camera inputs")
    state = StateService()
    latencies: list[float] = []
    total_tracks = 0
    for spec in camera_config["cameras"]:
        video = ROOT / camera_config["video"]["root"] / f"{spec['id']}.mp4"
        cap = cv2.VideoCapture(str(video))
        if not cap.isOpened():
            raise RuntimeError(f"{spec['id']} did not load: {video}")
        ok, frame = cap.read()
        cap.release()
        if not ok or frame is None:
            raise RuntimeError(f"{spec['id']} has no decodable frame")
        model = YOLO(str(weights))
        start = time.perf_counter()
        result = model.track(frame, persist=True, tracker=camera_config["model"]["tracker"],
            classes=[int(camera_config["model"]["person_class_id"])],
            conf=float(camera_config["model"]["confidence"]), iou=float(camera_config["model"]["iou"]),
            imgsz=int(camera_config["model"]["image_size"]), device=device, verbose=False)[0]
        latency = (time.perf_counter() - start) * 1000
        latencies.append(latency)
        detections = []
        if result.boxes is not None and result.boxes.id is not None:
            ids = result.boxes.id.int().cpu().tolist()
            boxes = result.boxes.xyxy.cpu().tolist()
            detections = [{"track_id": track_id, "bbox": box} for track_id, box in zip(ids, boxes)]
        h, w = frame.shape[:2]
        metrics = CameraMetrics(spec["id"], spec["line"], spec.get("direction_positive", "IN")).update(detections, 0, w, h)
        state.ingest(spec["id"], metrics)
        total_tracks += len(detections)
        print(f"  {spec['id']}: video OK, {len(detections)} current ByteTrack ID(s), inference {latency:.0f} ms")

    snapshot = state.snapshot()
    assert len(snapshot["cameras"]) == 6
    assert len(snapshot["zones"]) == 6
    assert snapshot["global_risk_score"] is not None
    assert snapshot["global_risk_state"] in {"SAFE", "WARNING", "HIGH", "CRITICAL"}
    assert len(snapshot["predictions"]) == 3
    assert snapshot["route"]["route"]
    print(f"State pipeline OK: {snapshot['global_risk_score']} {snapshot['global_risk_state']}; route {' → '.join(snapshot['route']['route'])}; 3 horizons")
    print(f"Risk components: {snapshot['risk_components']}; active recommendations: {len(snapshot['recommendations'])}")
    print(f"Measured first-frame detections: {total_tracks}; mean first-frame inference {sum(latencies)/len(latencies):.0f} ms")
    print("Performance note: this is an initialization smoke measurement, not a sustained six-feed real-time benchmark.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
