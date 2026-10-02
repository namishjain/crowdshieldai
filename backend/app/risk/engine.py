from __future__ import annotations

from typing import Any


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


class RiskEngine:
    def __init__(self, config: dict[str, Any], routing_config: dict[str, Any]):
        self.weights = config["weights"]
        self.thresholds = config["thresholds"]
        self.normalization = config["normalization"]
        self.routing = routing_config
        if round(sum(self.weights.values()), 6) != 1.0:
            raise ValueError("Risk weights must sum to 1.0")

    def classify(self, score: float) -> str:
        if score < float(self.thresholds["safe"]):
            return "SAFE"
        if score < float(self.thresholds["warning"]):
            return "WARNING"
        if score < float(self.thresholds["high"]):
            return "HIGH"
        return "CRITICAL"

    def score(self, *, count: int, capacity: int, flow_per_minute: float, evacuation_minutes: float) -> dict[str, Any]:
        norm = self.normalization
        density = clamp(count / max(1.0, float(norm["density_reference_people"])) * 100)
        flow = clamp(flow_per_minute / max(1.0, float(norm["flow_reference_crossings_per_minute"])) * 100)
        capacity_score = clamp(count / max(1, capacity) * 100)
        evac_score = clamp(evacuation_minutes / max(1.0, float(norm["evacuation_reference_minutes"])) * 100)
        parts = {
            "density": round(density, 2),
            "flow": round(flow, 2),
            "capacity": round(capacity_score, 2),
            "evacuation_time": round(evac_score, 2),
        }
        weighted = sum(float(self.weights[key]) * parts[key] for key in parts)
        value = round(clamp(weighted), 2)
        return {
            "components": parts,
            "risk_score": value,
            "risk_state": self.classify(value),
            "density_score": parts["density"],
            "flow_score": parts["flow"],
            "capacity_score": parts["capacity"],
            "evacuation_time_score": parts["evacuation_time"],
        }

