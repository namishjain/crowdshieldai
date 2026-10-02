from __future__ import annotations

import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from backend.app.config import ROOT, load_yaml
from backend.app.prediction.engine import TrendForecaster
from backend.app.recommendations.engine import RecommendationEngine
from backend.app.risk.engine import RiskEngine
from backend.app.routing.planner import RoutePlanner
from backend.app.schemas import CanonicalState, Event


class StateService:
    def __init__(self, database: Any | None = None):
        self.database = database
        self.camera_cfg = load_yaml("cameras.yaml")
        self.venue_cfg = load_yaml("venue.yaml")
        self.risk_cfg = load_yaml("risk.yaml")
        self.routing_cfg = load_yaml("routing.yaml")
        self.rec_cfg = load_yaml("recommendations.yaml")
        self.risk = RiskEngine(self.risk_cfg, self.routing_cfg)
        self.forecaster = TrendForecaster(self.risk, float(self.routing_cfg["assumptions"]["evacuation_exit_capacity_people_per_minute"]))
        self.recommender = RecommendationEngine(self.rec_cfg)
        self.planner = RoutePlanner(self.venue_cfg, self.routing_cfg)
        self.lock = threading.RLock()
        self.started_at: float | None = None
        self.gates = dict(self.venue_cfg["venue"]["gates"])
        self.raw: dict[str, dict[str, Any]] = {}
        for camera in self.camera_cfg["cameras"]:
            asset = ROOT / self.camera_cfg["video"]["root"] / f"{camera['id']}.mp4"
            self.raw[camera["id"]] = {
                "status": "READY" if asset.is_file() else "MISSING_VIDEO",
                "message": None if asset.is_file() else f"Video not found: {asset.relative_to(ROOT)}",
            }
        self.events: deque[Event] = deque(maxlen=60)
        self._last_event_times: dict[tuple[str, str, str | None, str | None], float] = {}
        self._prediction_critical = False
        self.simulation: dict[str, Any] | None = None
        self.active_feed_id = "original"
        self.active_feed_label = self.venue_cfg["venue"]["name"]
        self.active_operator_id = "Devansh Singh Bais"
        self.feed_notice = "Original Zurich WILDTRACK sample videos."
        self.system: dict[str, Any] = {
            "model": self.camera_cfg["model"]["name"],
            "device": "initializing",
            "processing_mode": "sampled frames + per-camera ByteTrack",
            "configured_cameras": len(self.camera_cfg["cameras"]),
            "prediction_method": "heuristic trend projection; no trained weights or accuracy claim",
            "asset_limit_bytes": int(self.camera_cfg["video"]["sample_limit_mb"]) * 1_000_000,
            "topology_status": self.venue_cfg["venue"]["topology_status"],
            "active_feed_id": self.active_feed_id,
            "active_feed_label": self.active_feed_label,
            "operator_id": self.active_operator_id,
            "footage_notice": self.feed_notice,
        }
        self.current = self._compose()
        self._last_state = "NO_DATA"
        self._last_route: tuple[str, ...] = ()
        self._last_recommendations: tuple[str, ...] = ()

    def select_feed(self, feed_id: str, feed_label: str, operator_id: str,
                    footage_notice: str, reset_measurements: bool = True) -> None:
        with self.lock:
            self.active_feed_id = feed_id
            self.active_feed_label = feed_label
            self.active_operator_id = operator_id
            self.feed_notice = footage_notice
            self.system.update({"active_feed_id": feed_id, "active_feed_label": feed_label,
                                "operator_id": operator_id, "footage_notice": footage_notice})
            if reset_measurements:
                self.started_at = None
                self.simulation = None
                self._prediction_critical = False
                self._last_state = "NO_DATA"
                self._last_route = ()
                self._last_recommendations = ()
                for spec in self.camera_cfg["cameras"]:
                    path = ROOT / self.camera_cfg["video"]["root"] / f"{spec['id']}.mp4"
                    self.raw[spec["id"]] = {
                        "status": "READY" if path.is_file() else "MISSING_VIDEO",
                        "message": None if path.is_file() else f"Video not found: {path.relative_to(ROOT)}",
                    }
            self._rebuild()

    def set_camera_status(self, camera_id: str, status: str, message: str | None = None, **extra: Any) -> None:
        with self.lock:
            existing = self.raw.setdefault(camera_id, {})
            existing.update({"status": status, "message": message, **extra})
            self._rebuild()

    def ingest(self, camera_id: str, update: dict[str, Any]) -> None:
        measurement: dict[str, Any] | None = None
        with self.lock:
            if self.started_at is None and update.get("status") == "LIVE":
                self.started_at = time.monotonic()
            self.raw.setdefault(camera_id, {}).update(update)
            self._rebuild()
            if self.database and update.get("count") is not None:
                measured_camera = next((item for item in self.current.cameras
                                        if item.camera_id == camera_id), None)
                if measured_camera:
                    measurement = measured_camera.model_dump(mode="json")
        if measurement:
            self.database.enqueue_measurement(measurement)

    def set_system(self, **updates: Any) -> None:
        with self.lock:
            self.system.update(updates)
            self._rebuild()

    def set_simulation(self, result: dict[str, Any] | None) -> None:
        with self.lock:
            self.simulation = result
            if result:
                self._add_event("SIMULATION_RUN", None, None, None, result["scenario_label"],
                                "Mesa agent-based what-if run based on available camera measurements.")
            self._rebuild()
        if result and self.database:
            self.database.enqueue_simulation(result)

    def set_gates(self, gates: dict[str, str]) -> None:
        with self.lock:
            previous = dict(self.gates)
            self.gates = dict(gates)
            risk_score = self.current.global_risk_score
            for gate_id, new_status in self.gates.items():
                old_status = previous.get(gate_id)
                if old_status and old_status != new_status:
                    self._add_event("GATE_STATE_CHANGED", old_status, new_status, risk_score,
                        f"{gate_id} set to {new_status}",
                        "Software route graph update only; no physical gate control was sent.")
            self._rebuild()

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return self.current.model_dump(mode="json")

    def _add_event(self, event_type: str, previous: str | None, current: str | None,
                   risk: float | None, action: str, reason: str, zone_id: str | None = None) -> None:
        throttle_zone = None if event_type == "ROUTE_CHANGED" else zone_id
        key = (event_type, action, throttle_zone, current)
        monotonic_now = time.monotonic()
        event_cooldowns = self.rec_cfg.get("event_cooldowns_seconds", {})
        cooldown = float(event_cooldowns.get(event_type, self.rec_cfg.get("cooldown_seconds", 6)))
        if monotonic_now - self._last_event_times.get(key, -cooldown) < cooldown:
            return
        self._last_event_times[key] = monotonic_now
        event = Event(event_id=uuid4().hex[:12], type=event_type,
            previous_state=previous, new_state=current, risk_score=risk, action=action,
            reason=reason, zone_id=zone_id)
        self.events.appendleft(event)
        if self.database:
            self.database.enqueue_event(event.model_dump(mode="json"))

    def _compose(self) -> CanonicalState:
        now = datetime.now(timezone.utc)
        camera_by_id = {str(c["id"]): c for c in self.camera_cfg["cameras"]}
        zone_by_camera = {str(z["camera_id"]): z for z in self.venue_cfg["venue"]["zones"]}
        cameras: list[dict[str, Any]] = []
        zones: list[dict[str, Any]] = []
        node_risk: dict[str, float] = {}
        node_count: dict[str, int] = {}
        measured = 0
        for camera_index, (camera_id, spec) in enumerate(camera_by_id.items(), start=1):
            zone_cfg = zone_by_camera[camera_id]
            zone_name = zone_cfg["name"] if self.active_feed_id == "original" else f"Sample View {camera_index:02d}"
            raw = self.raw.get(camera_id, {})
            count = raw.get("count")
            capacity = int(zone_cfg["capacity"])
            if count is not None:
                measured += 1
                evacuation_minutes = int(count) / max(1.0, float(self.routing_cfg["assumptions"]["evacuation_exit_capacity_people_per_minute"]))
                score = self.risk.score(count=int(count), capacity=capacity,
                    flow_per_minute=float(raw.get("flow_rate_per_minute") or 0), evacuation_minutes=evacuation_minutes)
                risk_state = score["risk_state"]
                node_risk[zone_cfg["node"]] = max(node_risk.get(zone_cfg["node"], 0.0), score["risk_score"])
                node_count[zone_cfg["node"]] = max(node_count.get(zone_cfg["node"], 0), int(count))
            else:
                evacuation_minutes, score, risk_state = None, {}, None
            camera = {
                "camera_id": camera_id,
                "zone_id": zone_cfg["id"],
                "zone_name": zone_name,
                "status": raw.get("status", "MISSING_VIDEO"),
                "video_time_seconds": float(raw.get("video_time_seconds") or 0),
                "count": int(count) if count is not None else None,
                "maximum_count": int(raw.get("maximum_count") or 0),
                "average_count": raw.get("average_count"),
                "count_trend_people_per_minute": raw.get("count_trend_people_per_minute"),
                "pixel_density": count,
                "density_score": score.get("density_score"),
                "flow_rate_per_minute": raw.get("flow_rate_per_minute"),
                "inbound_per_minute": raw.get("inbound_per_minute"),
                "outbound_per_minute": raw.get("outbound_per_minute"),
                "direction": raw.get("direction"),
                "average_speed_pixels_per_second": raw.get("average_speed_pixels_per_second"),
                "entry_count": int(raw.get("entry_count") or 0),
                "exit_count": int(raw.get("exit_count") or 0),
                "net_flow": int(raw.get("net_flow") or 0),
                "capacity": capacity,
                "capacity_utilization_percent": round(float(count) / capacity * 100, 1) if count is not None else None,
                "risk_score": score.get("risk_score"),
                "risk_state": risk_state,
                "risk_components": score.get("components", {}),
                "processing_fps": raw.get("processing_fps"),
                "inference_latency_ms": raw.get("inference_latency_ms"),
                "tracks": raw.get("tracks", []),
                "video_url": f"/media/{camera_id}.mp4?set={self.active_feed_id}" if raw.get("status") not in {"MISSING_VIDEO", "VIDEO_ERROR"} else None,
                "message": raw.get("message"),
            }
            cameras.append(camera)
            if count is not None:
                slope = float(raw.get("count_trend_people_per_minute") or 0)
                zones.append({
                    "zone_id": zone_cfg["id"], "name": zone_name, "node": zone_cfg["node"],
                    "camera_id": camera_id, "count": int(count), "capacity": capacity,
                    "risk_score": score["risk_score"], "risk_state": risk_state,
                    "density_score": score["density_score"], "flow_score": score["flow_score"],
                    "capacity_score": score["capacity_score"], "evacuation_time_score": score["evacuation_time_score"],
                    "evacuation_minutes": round(evacuation_minutes or 0, 2),
                    "trend": "increasing" if slope > 0.5 else "decreasing" if slope < -0.5 else "stable",
                    "trend_people_per_minute": slope,
                })
        if not zones:
            return CanonicalState(timestamp=now, demo_time_seconds=round(time.monotonic() - self.started_at, 1) if self.started_at else 0,
                venue={"id": self.active_feed_id, "name": self.active_feed_label,
                       "topology_status": self.venue_cfg["venue"]["topology_status"],
                       "measurement_basis": self.feed_notice},
                venue_state="NO_DATA", global_risk_score=None, global_risk_state="NO_DATA",
                cameras=cameras, zones=[], predictions=[], gates=self.gates,
                events=list(self.events), system=self.system, simulation=self.simulation)
        hot = max(zones, key=lambda z: float(z["risk_score"] or 0))
        global_score = float(hot["risk_score"] or 0)
        global_state = str(hot["risk_state"])
        # Use max-of-view risk and max count per configured graph node: overlapping cameras are not a unique global count.
        projected_by_horizon: dict[int, dict[str, Any]] = {}
        for zone in zones:
            raw = self.raw.get(zone["camera_id"], {})
            forecast = self.forecaster.predict(raw, int(zone["capacity"]))
            for point in forecast:
                old = projected_by_horizon.get(point["horizon_minutes"])
                if old is None or float(point["projected_risk_score"] or 0) > float(old["projected_risk_score"] or 0):
                    projected_by_horizon[point["horizon_minutes"]] = point
        predictions = [projected_by_horizon[k] for k in sorted(projected_by_horizon)]
        start_node = str(hot["node"])
        total_unique_estimate = sum(node_count.values())
        route = self.planner.calculate(start_node, gate_states=self.gates, zone_risk=node_risk,
            zone_count=node_count, total_people=total_unique_estimate)
        decision_zone = dict(hot)
        feeding_gate = self.venue_cfg["venue"].get("feeding_gates", {}).get(start_node)
        decision_zone["feeding_gate"] = feeding_gate
        if feeding_gate and self.gates.get(feeding_gate) == "OPEN":
            closed_gates = dict(self.gates)
            closed_gates[feeding_gate] = "CLOSED"
            alternate_route = self.planner.calculate(start_node, gate_states=closed_gates,
                zone_risk=node_risk, zone_count=node_count, total_people=total_unique_estimate)
            decision_zone["safe_to_close_gate"] = bool(alternate_route.get("route"))
        recommendations = self.recommender.evaluate(global_state, decision_zone, route, self.gates)
        if global_state != self._last_state:
            recovery = global_state in {"SAFE", "WARNING"} and self._last_state in {"HIGH", "CRITICAL"}
            self._add_event("RECOVERY" if recovery else "STATE_CHANGED", self._last_state, global_state,
                global_score, "Risk state changed", f"Highest view risk is {global_score:.1f} ({global_state}) at {hot['zone_id']}; based on measured camera counts.", hot["zone_id"])
            self._last_state = global_state
        route_key = tuple(route.get("route", []))
        if self._last_route and route_key != self._last_route:
            self._add_event("ROUTE_CHANGED", None, None, global_score, "Safe route recalculated",
                f"Risk/congestion or graph availability changed the route from {' → '.join(self._last_route)} to {' → '.join(route_key) or 'unavailable'}.", hot["zone_id"])
        self._last_route = route_key
        recommendation_key = tuple(sorted(item["action_id"] for item in recommendations))
        if recommendation_key != self._last_recommendations and recommendations:
            self._add_event("RECOMMENDATION_CHANGED", None, global_state, global_score,
                ", ".join(item["action_type"] for item in recommendations[:3]),
                f"The rule engine produced {len(recommendations)} active recommendation(s) from the current measured state.", hot["zone_id"])
        elif self._last_recommendations and not recommendation_key:
            self._add_event("RECOVERY", global_state, global_state, global_score,
                "Active recommendations resolved", "Current measurements no longer satisfy the active intervention rules.", hot["zone_id"])
        self._last_recommendations = recommendation_key
        predicted_critical = any(point.get("projected_risk_state") == "CRITICAL" for point in predictions)
        if predicted_critical and not self._prediction_critical:
            horizon = next(point["horizon_minutes"] for point in predictions if point.get("projected_risk_state") == "CRITICAL")
            self._add_event("PREDICTED_CRITICAL_STATE", None, "CRITICAL", global_score,
                f"Critical risk projected in {horizon} min", "The bounded trend forecast crosses the configured CRITICAL threshold.", hot["zone_id"])
        self._prediction_critical = predicted_critical
        max_video_time = max(
            int(self.raw.get(c["camera_id"], {}).get("loop_count", 0) or 0)
            * float(self.raw.get(c["camera_id"], {}).get("source_duration_seconds", 0) or 0)
            + float(c["video_time_seconds"] or 0)
            for c in cameras
        )
        return CanonicalState(timestamp=now, demo_time_seconds=round(time.monotonic() - self.started_at, 1) if self.started_at else 0,
            venue={"id": self.active_feed_id, "name": self.active_feed_label,
                   "topology_status": self.venue_cfg["venue"]["topology_status"],
                   "measurement_basis": f"{self.feed_notice} Measurements are per-view sample-video detections, not live CCTV or unique crowd counts.",
                   "views_with_measurements": measured, "demo_video_time_seconds": max_video_time},
            venue_state=global_state, global_risk_score=global_score, global_risk_state=global_state,
            global_risk_basis="maximum view-level risk; node counts use maximum mapped view count, not a unique-person sum",
            risk_components=next((camera["risk_components"] for camera in cameras
                                  if camera["zone_id"] == hot["zone_id"]), {}),
            cameras=cameras, zones=zones,
            predictions=predictions, route=route, recommendations=recommendations,
            events=list(self.events), gates=self.gates, simulation=self.simulation, system=self.system)

    def _rebuild(self) -> None:
        self.current = self._compose()
