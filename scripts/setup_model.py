from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "models" / "yolov8n.pt"
TARGET.parent.mkdir(parents=True, exist_ok=True)
CONFIG_DIR = ROOT / "work" / "ultralytics"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("YOLO_CONFIG_DIR", str(CONFIG_DIR))

from ultralytics import YOLO


def main() -> None:
    if TARGET.exists() and TARGET.stat().st_size > 1_000_000:
        path = TARGET
    else:
        print("Resolving official Ultralytics YOLOv8n weights (one-time download)…")
        previous = Path.cwd()
        try:
            os.chdir(TARGET.parent)
            model = YOLO("yolov8n.pt")
            candidate = Path(model.ckpt_path)
            source = candidate if candidate.is_absolute() else Path.cwd() / candidate
            if not source.is_file() and not candidate.is_absolute():
                source = TARGET.parent / candidate.name
            if not source.is_file():
                raise FileNotFoundError(f"Ultralytics loaded weights from an unexpected location: {source}")
            if source.resolve() != TARGET.resolve():
                shutil.copy2(source, TARGET)
        finally:
            os.chdir(previous)
        path = TARGET
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    print(f"Model ready: {path.relative_to(ROOT)} ({path.stat().st_size / 1_000_000:.2f} MB)")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()
