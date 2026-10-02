from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Track(BaseModel):
    track_id: int
    camera_id: str
    frame_number: int
    video_time_seconds: float
    bbox: list[float]
    center: list[float]
    trajectory: list[list[float]] = Field(default_factory=list)


class CameraMetric(BaseModel):
    camera_id: str
    zone_id: str
    zone_name: str
    status: str = "STARTING"
    video_time_seconds: float = 0
    count: int | None = None
    maximum_count: int = 0
    average_count: float | None = None
    count_trend_people_per_minute: float | None = None
    pixel_density: float | None = None
    density_score: float | None = None
    flow_rate_per_minute: float | None = None
    inbound_per_minute: float | None = None
    outbound_per_minute: float | None = None
    direction: str | None = None
    average_speed_pixels_per_second: float | None = None
    entry_count: int = 0
    exit_count: int = 0
    net_flow: int = 0
    capacity: int
    capacity_utilization_percent: float | None = None
    risk_score: float | None = None
    risk_state: str | None = None
    risk_components: dict[str, float] = Field(default_factory=dict)
    processing_fps: float | None = None
    inference_latency_ms: float | None = None
    tracks: list[Track] = Field(default_factory=list)
    video_url: str | None = None
    message: str | None = None


class ZoneMetric(BaseModel):
    zone_id: str
    name: str
    node: str
    camera_id: str
    count: int | None = None
    capacity: int
    risk_score: float | None = None
    risk_state: str | None = None
    density_score: float | None = None
    flow_score: float | None = None
    capacity_score: float | None = None
    evacuation_time_score: float | None = None
    evacuation_minutes: float | None = None
    trend: str = "unknown"
    trend_people_per_minute: float | None = None


class ForecastPoint(BaseModel):
    horizon_minutes: int
    projected_count: int | None = None
    projected_risk_score: float | None = None
    projected_risk_state: str | None = None


class Recommendation(BaseModel):
    action_id: str
    action_type: str
    priority: Literal["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    target: str
    reason: str
    expected_effect: str
    source_zone: str | None = None
    timestamp: datetime = Field(default_factory=utc_now)
    simulated: bool = False


class RouteResult(BaseModel):
    route: list[str] = Field(default_factory=list)
    node_names: list[str] = Field(default_factory=list)
    destination: str | None = None
    total_cost: float | None = None
    distance_m: float | None = None
    route_risk: float | None = None
    congestion_percent: float | None = None
    estimated_travel_seconds: float | None = None
    estimated_evacuation_minutes: float | None = None
    reason: str = ""


class Event(BaseModel):
    event_id: str
    type: str
    timestamp: datetime = Field(default_factory=utc_now)
    previous_state: str | None = None
    new_state: str | None = None
    risk_score: float | None = None
    zone_id: str | None = None
    action: str
    reason: str


class CanonicalState(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    demo_time_seconds: float = 0
    venue: dict[str, Any] = Field(default_factory=dict)
    venue_state: str = "NO_DATA"
    global_risk_score: float | None = None
    global_risk_state: str = "NO_DATA"
    global_risk_basis: str = "maximum camera-view risk; not a unique-person sum"
    risk_components: dict[str, float] = Field(default_factory=dict)
    cameras: list[CameraMetric] = Field(default_factory=list)
    zones: list[ZoneMetric] = Field(default_factory=list)
    predictions: list[ForecastPoint] = Field(default_factory=list)
    prediction_method: str = "heuristic projection from observed count trend; not a trained model"
    route: RouteResult = Field(default_factory=RouteResult)
    recommendations: list[Recommendation] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    gates: dict[str, str] = Field(default_factory=dict)
    simulation: dict[str, Any] | None = None
    system: dict[str, Any] = Field(default_factory=dict)


class ScenarioRequest(BaseModel):
    scenario_id: str
    target: str | None = None
    steps: int = Field(default=10, ge=1, le=60)
