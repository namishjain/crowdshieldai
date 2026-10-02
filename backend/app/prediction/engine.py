from __future__ import annotations

from typing import Any

from backend.app.risk.engine import RiskEngine, clamp


class TrendForecaster:
    """Short-history linear projection; explicitly not an XGBoost model."""

    def __init__(self, risk_engine: RiskEngine, evacuation_people_per_minute: float):
        self.risk = risk_engine
        self.exit_capacity = evacuation_people_per_minute

    def predict(self, camera: dict[str, Any], capacity: int, horizons: tuple[int, ...] = (10, 20, 30)) -> list[dict[str, Any]]:
        count = camera.get("count")
        if count is None:
            return [{"horizon_minutes": h, "projected_count": None, "projected_risk_score": None, "projected_risk_state": "NO_DATA"} for h in horizons]
        observed_slope = float(camera.get("count_trend_people_per_minute") or 0)
        max_slope = capacity * float(self.risk.normalization.get(
            "maximum_forecast_slope_fraction_of_capacity_per_minute", 0.01))
        slope = max(-max_slope, min(max_slope, observed_slope))
        # Avoid extrapolating a short clip without bound: at most 2x the configured view capacity.
        ceiling = max(capacity, capacity * 2)
        forecast: list[dict[str, Any]] = []
        for horizon in horizons:
            projected = int(round(clamp(count + slope * horizon, 0, ceiling)))
            estimated_evacuation = projected / max(1.0, self.exit_capacity)
            risk = self.risk.score(
                count=projected,
                capacity=capacity,
                flow_per_minute=float(camera.get("flow_rate_per_minute") or 0),
                evacuation_minutes=estimated_evacuation,
            )
            forecast.append({
                "horizon_minutes": horizon,
                "projected_count": projected,
                "projected_risk_score": risk["risk_score"],
                "projected_risk_state": risk["risk_state"],
            })
        return forecast
