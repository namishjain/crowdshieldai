from __future__ import annotations

import os

os.environ["CROWDSHIELD_DISABLE_CV"] = "1"

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.state import StateService


def test_health_state_and_websocket_schema():
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["cameras_configured"] == 6
        assert "database" in health.json()
        database_status = client.get("/api/database/status")
        assert database_status.status_code == 200
        if not database_status.json()["enabled"]:
            assert database_status.json()["status"] == "disabled"
            assert client.get("/api/history/measurements").status_code == 503
        state = client.get("/api/state").json()
        assert state["global_risk_state"] == "NO_DATA"
        assert len(state["cameras"]) == 6
        with client.websocket_connect("/ws/live") as socket:
            message = socket.receive_json()
            assert message["global_risk_state"] == "NO_DATA"
            assert len(message["cameras"]) == 6


def test_scenario_endpoint_rejects_when_no_camera_measurements():
    with TestClient(app) as client:
        response = client.post("/api/simulate", json={"scenario_id": "close_gate_a"})
        assert response.status_code == 409
        assert "measured camera counts" in response.json()["detail"]


def test_gate_command_is_only_a_configured_graph_change():
    with TestClient(app) as client:
        response = client.post("/api/gates/GATE_A/CLOSED")
        assert response.status_code == 200
        assert response.json()["mode"].startswith("software graph only")
        assert client.get("/api/state").json()["gates"]["GATE_A"] == "CLOSED"


def test_canonical_state_includes_risk_components_for_selected_hot_view():
    service = StateService()
    service.ingest("camera_01", {"status": "LIVE", "count": 20, "flow_rate_per_minute": 3,
        "count_trend_people_per_minute": 1.5, "tracks": []})
    snapshot = service.snapshot()
    assert snapshot["global_risk_score"] is not None
    assert set(snapshot["risk_components"]) == {"density", "flow", "capacity", "evacuation_time"}
    assert snapshot["zones"][0]["zone_id"] == "VIEW_01"


def test_database_service_disabled_mode_is_explicit_and_safe():
    import pytest

    from backend.app.database import DatabaseService, DatabaseUnavailable

    database = DatabaseService(None)
    assert database.status() == {
        "enabled": False,
        "connected": False,
        "status": "disabled",
        "queued_records": 0,
        "dropped_records": 0,
        "last_error": None,
    }
    database.enqueue_measurement({"camera_id": "camera_01", "count": 2, "tracks": []})
    assert database.status()["queued_records"] == 0
    with pytest.raises(DatabaseUnavailable, match="not configured"):
        database.history_measurements(None, 10)


def test_database_service_queues_aggregate_measurement_without_track_data():
    from backend.app.database import DatabaseService

    database = DatabaseService("postgres://postgres:pass@localhost/crowdshield")
    assert database.database_url == "postgresql://postgres:pass@localhost/crowdshield"
    database.enqueue_measurement({"camera_id": "camera_01", "count": 3,
                                  "tracks": [{"track_id": 7, "bbox": [1, 2, 3, 4]}]})
    record = database._queue.get_nowait()
    assert record["camera"]["count"] == 3
    assert "tracks" not in record["camera"]
