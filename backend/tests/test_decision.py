from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from backend.app.metrics.engine import CameraMetrics
from backend.app.prediction.engine import TrendForecaster
from backend.app.recommendations.engine import RecommendationEngine
from backend.app.risk.engine import RiskEngine
from backend.app.routing.planner import RoutePlanner
from backend.app.simulation.engine import SimulationEngine
from backend.app.state import StateService

ROOT = Path(__file__).resolve().parents[2]


def config(name: str):
    return yaml.safe_load((ROOT / "configs" / name).read_text(encoding="utf-8"))


@pytest.fixture
def services():
    routing = config("routing.yaml")
    venue = config("venue.yaml")
    risk = RiskEngine(config("risk.yaml"), routing)
    recommendations = RecommendationEngine(config("recommendations.yaml"))
    routes = RoutePlanner(venue, routing)
    simulation = SimulationEngine(venue, routing, risk, recommendations, config("scenarios.yaml"))
    return risk, recommendations, routes, simulation


def test_risk_formula_and_boundaries(services):
    risk, *_ = services
    result = risk.score(count=21, capacity=42, flow_per_minute=15, evacuation_minutes=6)
    expected = 0.40 * 50 + 0.25 * 50 + 0.20 * 50 + 0.15 * 50
    assert result["risk_score"] == expected == 50
    assert result["risk_state"] == "WARNING"
    assert risk.classify(29.99) == "SAFE"
    assert risk.classify(30) == "WARNING"
    assert risk.classify(60) == "HIGH"
    assert risk.classify(80) == "CRITICAL"
    assert risk.score(count=10000, capacity=1, flow_per_minute=10000, evacuation_minutes=10000)["risk_score"] == 100


def test_forecast_limits_noisy_slope_to_configured_capacity_fraction(services):
    risk, *_ = services
    forecaster = TrendForecaster(risk, evacuation_people_per_minute=10)
    points = forecaster.predict({"count": 8, "count_trend_people_per_minute": -1000}, capacity=42)
    assert points[0]["projected_count"] == 4
    assert points[-1]["projected_count"] == 0
    assert all(point["projected_count"] <= 84 for point in points)


def test_demo_video_clock_includes_completed_clip_loops():
    state = StateService()
    state.ingest("camera_01", {"status": "LIVE", "count": 8, "loop_count": 3,
                               "source_duration_seconds": 15.0, "video_time_seconds": 5.0})
    assert state.snapshot()["venue"]["demo_video_time_seconds"] == 50.0


def test_metrics_unique_tracks_line_crossing_direction_and_speed():
    engine = CameraMetrics("camera_01", [[0, 0.5], [1, 0.5]])
    first = engine.update([{"track_id": 1, "bbox": [40, 20, 60, 40]},
                           {"track_id": 2, "bbox": [10, 10, 30, 30]}], 0, 100, 100)
    assert first["count"] == 2
    second = engine.update([{"track_id": 1, "bbox": [40, 65, 60, 85]},
                            {"track_id": 2, "bbox": [10, 12, 30, 32]}], 1, 100, 100)
    assert second["count"] == 2
    assert second["entry_count"] == 1
    assert second["average_speed_pixels_per_second"] > 0
    assert second["tracks"][0]["track_id"] == 1
    assert second["tracks"][0]["trajectory"][-1][2] == 1


def test_safe_recommendation_is_empty_and_critical_rules_are_explainable(services):
    _, recommender, _, _ = services
    assert recommender.evaluate("SAFE", {"zone_id": "VIEW_01", "risk_score": 20}, {}, {}) == []
    critical = recommender.evaluate("CRITICAL", {"zone_id": "VIEW_01", "risk_score": 93, "count": 45, "capacity": 42},
        {"destination": "EXIT_B", "route_risk": 70}, {"GATE_A": "OPEN", "GATE_D": "CLOSED"})
    actions = {item["action_type"] for item in critical}
    assert {"RESTRICT_INFLOW", "OPEN_GATE", "ISSUE_PUBLIC_ADVISORY", "DEPLOY_SECURITY", "REROUTE"} <= actions
    assert all(item["reason"] and item["expected_effect"] for item in critical)


def test_dijkstra_uses_open_exit_and_respects_gate_closure(services):
    _, _, routes, _ = services
    open_route = routes.calculate("CENTRAL", gate_states={"GATE_A": "OPEN", "GATE_B": "OPEN", "GATE_C": "OPEN", "GATE_D": "OPEN"}, total_people=20)
    assert open_route["destination"] in {"EXIT_A", "EXIT_B", "EXIT_C"}
    assert open_route["route"]
    blocked = routes.calculate("ZONE_EAST", gate_states={"GATE_A": "OPEN", "GATE_B": "CLOSED", "GATE_C": "OPEN", "GATE_D": "CLOSED"}, total_people=20)
    assert "EXIT_B" not in blocked["route"]
    assert "EXIT_A" not in blocked["route"]
    assert blocked["destination"] == "EXIT_C"


def test_mesa_scenario_changes_graph_and_returns_measured_baseline(services):
    _, _, _, simulation = services
    zones = [
        {"zone_id": "VIEW_01", "node": "ZONE_WEST", "count": 20, "capacity": 42, "risk_score": 35, "risk_state": "WARNING", "trend_people_per_minute": 1},
        {"zone_id": "VIEW_02", "node": "CENTRAL", "count": 24, "capacity": 42, "risk_score": 40, "risk_state": "WARNING", "trend_people_per_minute": 0},
        {"zone_id": "VIEW_06", "node": "ZONE_WEST", "count": 18, "capacity": 42, "risk_score": 30, "risk_state": "WARNING", "trend_people_per_minute": 0},
    ]
    result = simulation.run("block_exit_b", zones, {"GATE_A": "OPEN", "GATE_B": "OPEN", "GATE_C": "OPEN", "GATE_D": "OPEN"}, steps=4)
    assert result["mode"] == "MESA_AGENT_BASED_SIMULATION"
    assert result["before"]["people_in_simulation"] == 44  # overlapping VIEW_01/VIEW_06 are collapsed with max()
    assert result["after"]["route"]["destination"] != "EXIT_B"
    assert result["after"]["steps"] == 4
    assert result["limitations"]


@pytest.mark.parametrize("scenario_id", [
    "close_gate_a", "open_gate_d", "block_exit_b", "emergency_zone_c",
    "medical_zone_d", "power_failure", "heavy_crowd", "heavy_rain",
])
def test_every_configured_what_if_scenario_runs(services, scenario_id):
    _, _, _, simulation = services
    zones = [
        {"zone_id": "VIEW_01", "node": "ZONE_WEST", "count": 20, "capacity": 42, "risk_score": 35, "risk_state": "WARNING", "trend_people_per_minute": 1},
        {"zone_id": "VIEW_02", "node": "CENTRAL", "count": 24, "capacity": 42, "risk_score": 40, "risk_state": "WARNING", "trend_people_per_minute": 0},
        {"zone_id": "VIEW_03", "node": "ZONE_EAST", "count": 12, "capacity": 42, "risk_score": 20, "risk_state": "SAFE", "trend_people_per_minute": 0},
    ]
    gates = {"GATE_A": "OPEN", "GATE_B": "OPEN", "GATE_C": "OPEN", "GATE_D": "RESTRICTED"}
    result = simulation.run(scenario_id, zones, gates, steps=3)
    assert result["mode"] == "MESA_AGENT_BASED_SIMULATION"
    assert result["before"]["people_in_simulation"] == 56
    assert result["after"]["route"]["route"]
    assert result["after"]["steps"] == 3
    if scenario_id == "close_gate_a":
        assert result["after"]["gate_states"]["GATE_A"] == "CLOSED"
    elif scenario_id == "open_gate_d":
        assert result["after"]["gate_states"]["GATE_D"] == "OPEN"
    elif scenario_id == "block_exit_b":
        assert "EXIT_B" not in result["after"]["route"]["route"]
    elif scenario_id == "emergency_zone_c":
        assert result["after"]["risk_score"] > result["before"]["risk_score"]
    elif scenario_id == "medical_zone_d":
        assert result["target"] == "ZONE_EAST"
        assert result["after"]["risk_score"] > result["before"]["risk_score"]
    elif scenario_id == "power_failure":
        assert result["after"]["gate_states"]["GATE_C"] == "CLOSED"
        assert result["after"]["risk_score"] > result["before"]["risk_score"]
    elif scenario_id in {"heavy_crowd", "heavy_rain"}:
        assert result["after"]["risk_score"] > result["before"]["risk_score"]
