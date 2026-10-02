from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import cv2
import imageio_ffmpeg
import yaml

ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket() as handle:
        handle.bind(("127.0.0.1", 0))
        return int(handle.getsockname()[1])


def wait_for_proxy(port: int, process: subprocess.Popen[str]) -> None:
    deadline = time.time() + 20
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError("The byte-range proxy exited during startup.")
        try:
            with urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as response:
                if json.load(response).get("ok"):
                    return
        except (OSError, URLError, TimeoutError):
            time.sleep(0.25)
    raise TimeoutError("The local byte-range proxy did not become ready.")


def proxy_stats(port: int) -> dict[str, int]:
    with urlopen(f"http://127.0.0.1:{port}/health", timeout=3) as response:
        return json.load(response)


def probe_video(path: Path) -> dict[str, float | int]:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV could not open transcoded file {path.name}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    ok, frame = cap.read()
    cap.release()
    if not ok or frame is None or frame_count < 1:
        raise RuntimeError(f"Transcoded clip has no decodable video frames: {path.name}")
    return {"width": width, "height": height, "fps": round(fps, 3), "frames": frame_count,
            "duration_seconds": round(frame_count / max(fps, 0.001), 2)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and transcode short WILDTRACK clips using capped HTTP byte ranges.")
    parser.add_argument("--duration", type=int, default=15, help="Output clip length in seconds (default: 15).")
    parser.add_argument("--max-total-mb", type=int, default=2000, help="Hard cap for stored six-video output (default: 2000 MB).")
    parser.add_argument("--proxy-transfer-mb", type=int, default=1850, help="Hard cap on remote bytes streamed through the local proxy.")
    parser.add_argument("--camera-ids", nargs="*", help="Optional subset for diagnosis, e.g. --camera-ids camera_01.")
    args = parser.parse_args()
    if not 5 <= args.duration <= 120:
        parser.error("--duration must be between 5 and 120 seconds.")

    config_path = ROOT / "configs" / "cameras.yaml"
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    video_root = ROOT / config["video"]["root"]
    video_root.mkdir(parents=True, exist_ok=True)
    videos = [(spec["id"], spec["source_id"], video_root / f"{spec['id']}.mp4") for spec in config["cameras"]
              if not args.camera_ids or spec["id"] in set(args.camera_ids)]
    if not videos:
        raise ValueError("No configured camera ID matched --camera-ids.")
    if args.camera_ids and any(camera_id not in {item[0] for item in videos} for camera_id in args.camera_ids):
        raise ValueError("One or more --camera-ids are not in configs/cameras.yaml.")
    for _, _, path in videos:
        path.with_suffix(".part.mp4").unlink(missing_ok=True)
    valid_existing: set[str] = set()
    for camera_id, _, path in videos:
        if path.exists():
            try:
                info = probe_video(path)
                if abs(float(info["duration_seconds"]) - args.duration) <= 1.0 and info["width"] <= 640:
                    valid_existing.add(camera_id)
                    print(f"[REUSE] {camera_id}: verified existing {info['duration_seconds']}s clip ({path.stat().st_size / 1_000_000:.1f} MB).")
            except Exception:
                pass
    if not valid_existing and any(path.exists() for _, _, path in videos):
        print("Existing camera clips do not match the requested duration/size and will be replaced.")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"FFmpeg: {ffmpeg}")
    print(f"Output request: {len(videos)} synchronized {args.duration}s clip(s); output cap {args.max_total_mb} MB.")
    print("Remote sources are read by HTTP byte ranges only; the 7.4 GB originals are never saved locally.")

    port = free_port()
    env = os.environ.copy()
    env["CROWD_PROXY_PORT"] = str(port)
    env["CROWD_DATA_MAX_BYTES"] = str(args.proxy_transfer_mb * 1_000_000)
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js was not found on PATH; it is required for trusted HTTPS byte-range proxying.")
    proxy = subprocess.Popen([node, "--use-system-ca", str(ROOT / "scripts" / "wildtrack_range_proxy.mjs")],
        cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        wait_for_proxy(port, proxy)
        for camera_id, source_id, destination in videos:
            if camera_id in valid_existing:
                continue
            temp = destination.with_suffix(".part.mp4")
            temp.unlink(missing_ok=True)
            url = f"http://127.0.0.1:{port}/{camera_id}.mp4"
            vf = "fps=10,scale=w='min(640,iw)':h=-2:force_original_aspect_ratio=decrease"
            cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", url,
                   "-t", str(args.duration), "-an", "-vf", vf,
                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "29",
                   "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temp)]
            print(f"[FETCH] {camera_id}: requesting only enough ranges to transcode {args.duration} seconds…", flush=True)
            try:
                result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=900)
            except BaseException:
                temp.unlink(missing_ok=True)
                raise
            if result.returncode != 0:
                temp.unlink(missing_ok=True)
                detail = (result.stderr or result.stdout)[-4000:]
                raise RuntimeError(f"FFmpeg failed for {camera_id} (exit {result.returncode}):\n{detail}")
            if not temp.exists() or temp.stat().st_size == 0:
                raise RuntimeError(f"FFmpeg produced no file for {camera_id}.")
            info = probe_video(temp)
            if abs(float(info["duration_seconds"]) - args.duration) > 1.0:
                temp.unlink(missing_ok=True)
                raise RuntimeError(f"{camera_id} excerpt duration is {info['duration_seconds']}s, expected about {args.duration}s; no clip was accepted.")
            temp.replace(destination)
            total_size = sum(path.stat().st_size for _, _, path in videos if path.exists())
            bytes_reserved = proxy_stats(port)["transferred_bytes"]
            print(f"[OK] {camera_id}: {info['width']}x{info['height']} @ {info['fps']} fps, "
                  f"{info['duration_seconds']}s, {destination.stat().st_size / 1_000_000:.1f} MB; "
                  f"selected-clip total {total_size / 1_000_000:.1f} MB; "
                  f"source range budget {bytes_reserved / 1_000_000:.1f} MB", flush=True)
            if total_size > args.max_total_mb * 1_000_000:
                raise RuntimeError(f"Combined video output exceeded the {args.max_total_mb} MB cap.")
    finally:
        proxy.terminate()
        try:
            proxy.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proxy.kill()
        if proxy.stdout:
            summary = proxy.stdout.read()
            if summary.strip():
                print(summary.strip())

    if not args.camera_ids and not all(path.exists() for _, _, path in videos):
        raise RuntimeError("Not all six camera files were created.")
    outputs = {camera_id: {"file": str(path.relative_to(ROOT)).replace("\\", "/"),
                           "size_bytes": path.stat().st_size, **probe_video(path)}
               for camera_id, _, path in videos}
    manifest = {
        "dataset": "WILDTRACK",
        "source": "https://www.epfl.ch/labs/cvlab/data/data-wildtrack/",
        "source_cameras_are_synchronized": True,
        "excerpt_seconds_requested": args.duration,
        "local_total_bytes": sum(item["size_bytes"] for item in outputs.values()),
        "local_total_limit_bytes": args.max_total_mb * 1_000_000,
        "cameras": outputs,
    }
    (video_root / "asset_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    count = len(outputs)
    label = "All six camera clips" if count == 6 else f"All {count} selected camera clip(s)"
    print(f"\n{label} are ready. Local video total: {manifest['local_total_bytes'] / 1_000_000:.1f} MB.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"\nSETUP FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
