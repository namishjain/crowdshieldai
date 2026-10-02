from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from math import hypot
from typing import Any


@dataclass
class Sample:
    time_seconds: float
    count: int


class CameraMetrics:
    """Rolling image-space measurements for one independently tracked view."""

    def __init__(self, camera_id: str, line: list[list[float]], direction_positive: str = "IN"):
        self.camera_id = camera_id
        self.line = line
        self.direction_positive = direction_positive
        self.samples: deque[Sample] = deque(maxlen=180)
        self.positions: dict[int, tuple[float, float, float]] = {}
        self.trajectories: dict[int, deque[list[float]]] = defaultdict(lambda: deque(maxlen=20))
        self.last_line_side: dict[int, int] = {}
        self.crossings: deque[tuple[float, int]] = deque(maxlen=600)
        self.max_count = 0
        self.frame_number = 0

    @staticmethod
    def _side(point: tuple[float, float], line: list[list[float]]) -> float:
        (x1, y1), (x2, y2) = line
        return (x2 - x1) * (point[1] - y1) - (y2 - y1) * (point[0] - x1)

    def update(self, detections: list[dict[str, Any]], video_time: float,
               frame_width: int = 1, frame_height: int = 1) -> dict[str, Any]:
        self.frame_number += 1
        now = max(0.0, float(video_time))
        current_ids: set[int] = set()
        speeds: list[float] = []
        directions: list[str] = []
        tracks: list[dict[str, Any]] = []
        inbound = outbound = 0

        for item in detections:
            track_id = int(item["track_id"])
            x1, y1, x2, y2 = map(float, item["bbox"])
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            center = (cx, cy)
            current_ids.add(track_id)
            previous = self.positions.get(track_id)
            if previous and now > previous[0]:
                elapsed = now - previous[0]
                dx, dy = cx - previous[1], cy - previous[2]
                speeds.append(hypot(dx, dy) / elapsed)
                if abs(dx) + abs(dy) > 1.0:
                    directions.append("RIGHT" if abs(dx) >= abs(dy) and dx > 0 else "LEFT" if abs(dx) >= abs(dy) else "DOWN" if dy > 0 else "UP")
            self.positions[track_id] = (now, cx, cy)
            self.trajectories[track_id].append([round(cx, 1), round(cy, 1), round(now, 2)])

            normalized_center = (cx / max(1, frame_width), cy / max(1, frame_height))
            side = self._side(normalized_center, self.line)
            sign = 1 if side >= 0 else -1
            old_sign = self.last_line_side.get(track_id)
            if old_sign is not None and sign != old_sign:
                direction = 1 if sign > old_sign else -1
                self.crossings.append((now, direction))
                if (direction > 0) == (self.direction_positive == "IN"):
                    inbound += 1
                else:
                    outbound += 1
            self.last_line_side[track_id] = sign
            tracks.append({
                "track_id": track_id,
                "camera_id": self.camera_id,
                "frame_number": self.frame_number,
                "video_time_seconds": round(now, 2),
                "bbox": [round(v, 1) for v in (x1, y1, x2, y2)],
                "center": [round(cx, 1), round(cy, 1)],
                "trajectory": list(self.trajectories[track_id]),
            })

        self.samples.append(Sample(now, len(current_ids)))
        self.max_count = max(self.max_count, len(current_ids))
        self.positions = {track_id: value for track_id, value in self.positions.items() if track_id in current_ids}
        self.trajectories = defaultdict(lambda: deque(maxlen=20), {k: v for k, v in self.trajectories.items() if k in current_ids})
        self.last_line_side = {k: v for k, v in self.last_line_side.items() if k in current_ids}

        while self.crossings and now - self.crossings[0][0] > 60:
            self.crossings.popleft()
        recent = [sample for sample in self.samples if now - sample.time_seconds <= 30]
        if len(recent) >= 2 and recent[-1].time_seconds > recent[0].time_seconds:
            slope = (recent[-1].count - recent[0].count) / (recent[-1].time_seconds - recent[0].time_seconds) * 60
        else:
            slope = 0.0
        crossings_last_min = [direction for time_value, direction in self.crossings if now - time_value <= 60]
        inbound_rate = sum(1 for d in crossings_last_min if d > 0)
        outbound_rate = sum(1 for d in crossings_last_min if d < 0)
        flow_rate = len(crossings_last_min)
        return {
            "camera_id": self.camera_id,
            "status": "LIVE",
            "video_time_seconds": round(now, 2),
            "frame_number": self.frame_number,
            "count": len(current_ids),
            "maximum_count": self.max_count,
            "average_count": round(sum(sample.count for sample in recent) / max(1, len(recent)), 1),
            "count_trend_people_per_minute": round(slope, 2),
            "pixel_density": len(current_ids),
            "flow_rate_per_minute": flow_rate,
            "inbound_per_minute": inbound_rate,
            "outbound_per_minute": outbound_rate,
            "entry_count": inbound,
            "exit_count": outbound,
            "net_flow": inbound - outbound,
            "direction": max(set(directions), key=directions.count) if directions else "STATIONARY/UNKNOWN",
            "average_speed_pixels_per_second": round(sum(speeds) / len(speeds), 2) if speeds else 0.0,
            "tracks": tracks,
        }
