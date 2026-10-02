from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from backend.app.config import ROOT, load_yaml
from backend.app.cv.manager import VideoManager
from backend.app.database import DatabaseService, DatabaseUnavailable
from backend.app.recommendations.engine import RecommendationEngine
from backend.app.risk.engine import RiskEngine
from backend.app.schemas import ScenarioRequest
from backend.app.simulation.engine import SimulationEngine
from backend.app.state import StateService


logging.basicConfig(level=os.getenv("CROWDSHIELD_LOG_LEVEL", "INFO"),
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("crowdshield")

load_dotenv(ROOT / ".env", override=False)
database_service = DatabaseService(os.getenv("CROWDSHIELD_DATABASE_URL"))
state_service = StateService(database_service)
camera_config = state_service.camera_cfg
video_dir = ROOT / camera_config["video"]["root"]
video_dir.mkdir(parents=True, exist_ok=True)
manager = VideoManager(camera_config, ROOT, state_service.ingest, state_service.set_system)
risk_engine = RiskEngine(state_service.risk_cfg, state_service.routing_cfg)
recommendation_engine = RecommendationEngine(state_service.rec_cfg)
simulation_engine = SimulationEngine(state_service.venue_cfg, state_service.routing_cfg,
    risk_engine, recommendation_engine, load_yaml("scenarios.yaml"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    database_service.start()
    if os.getenv("CROWDSHIELD_DISABLE_CV", "0").lower() not in {"1", "true", "yes"}:
        state_service.set_system(device="checking", backend_status="starting")
        manager.start()
    else:
        state_service.set_system(device="test mode", backend_status="CV disabled by environment")
    try:
        yield
    finally:
        manager.stop()
        database_service.stop()


app = FastAPI(title="CrowdShield AI", version="1.0.0", lifespan=lifespan,
              description="Video-driven crowd decision support prototype. Recommendations require operator review.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["*"])

OPERATOR_FEEDS = {
    "devansh singh bais": {
        "operator_id": "Devansh Singh Bais", "set_id": "original", "root": "data/videos",
        "label": "ETH Zurich Courtyard (WILDTRACK)",
        "notice": "Original Zurich WILDTRACK sample videos.",
    },
    "amrendra sharma": {
        "operator_id": "Amrendra Sharma", "set_id": "religious", "root": "data/videos/sets/religious",
        "label": "Religious Event Samples",
        "notice": "Licensed public recordings of Indian religious events; not CCTV footage.",
    },
    "namish jain": {
        "operator_id": "Namish Jain", "set_id": "railway_india", "root": "data/videos/sets/railway_india",
        "label": "Indian Railway Samples",
        "notice": "Licensed public recordings at Indian railway stations; not CCTV footage.",
    },
}


class OperatorSelection(BaseModel):
    operator_id: str = Field(min_length=1, max_length=48)


@app.get("/health")
def health() -> dict:
    state = state_service.snapshot()
    return {"ok": True, "status": state.get("system", {}).get("backend_status", "ready"),
            "cameras_configured": len(camera_config["cameras"]),
            "cameras_with_measurements": sum(c["count"] is not None for c in state["cameras"]),
            "risk_state": state["global_risk_state"],
            "database": database_service.status()}


@app.get("/api/state")
def get_state() -> dict:
    return state_service.snapshot()


@app.post("/api/operator")
def select_operator(request: OperatorSelection) -> dict:
    normalized = " ".join(request.operator_id.strip().casefold().split())
    profile = OPERATOR_FEEDS.get(normalized)
    if profile is None:
        allowed = ", ".join(item["operator_id"] for item in OPERATOR_FEEDS.values())
        raise HTTPException(status_code=422, detail=f"Choose one of the demo operator IDs: {allowed}.")
    try:
        changed = manager.select_video_set(profile["set_id"], profile["root"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    state_service.select_feed(profile["set_id"], profile["label"], profile["operator_id"],
                              profile["notice"], reset_measurements=changed)
    return {"operator_id": profile["operator_id"], "feed_id": profile["set_id"],
            "feed_label": profile["label"], "changed": changed,
            "footage_notice": profile["notice"]}


@app.get("/api/cameras")
def get_cameras() -> list[dict]:
    return state_service.snapshot()["cameras"]


@app.get("/api/events")
def get_events() -> list[dict]:
    return state_service.snapshot()["events"]


@app.get("/api/database/status")
def get_database_status() -> dict:
    return database_service.status()


@app.get("/api/history/measurements")
def get_measurement_history(camera_id: str | None = None,
                            limit: int = Query(default=300, ge=1, le=2000)) -> list[dict]:
    try:
        return database_service.history_measurements(camera_id, limit)
    except DatabaseUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/history/events")
def get_event_history(limit: int = Query(default=300, ge=1, le=2000)) -> list[dict]:
    try:
        return database_service.history_events(limit)
    except DatabaseUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/history/simulations")
def get_simulation_history(limit: int = Query(default=100, ge=1, le=500)) -> list[dict]:
    try:
        return database_service.history_simulations(limit)
    except DatabaseUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/config")
def get_config_summary() -> dict:
    return {
        "risk_weights": state_service.risk_cfg["weights"],
        "risk_thresholds": state_service.risk_cfg["thresholds"],
        "camera_interval_seconds": camera_config["model"]["inference_interval_seconds"],
        "configured_cameras": [c["id"] for c in camera_config["cameras"]],
        "topology_status": state_service.venue_cfg["venue"]["topology_status"],
        "scenarios": load_yaml("scenarios.yaml")["scenarios"],
        "active_feed_id": state_service.active_feed_id,
        "active_feed_label": state_service.active_feed_label,
        "operator_ids": [item["operator_id"] for item in OPERATOR_FEEDS.values()],
    }


@app.get("/media/{filename}")
def get_camera_video(filename: str) -> FileResponse:
    allowed = {f"{spec['id']}.mp4" for spec in camera_config["cameras"]}
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Camera video not found")
    directory = (ROOT / camera_config["video"]["root"]).resolve()
    path = (directory / filename).resolve()
    if not path.is_relative_to(directory) or not path.is_file():
        raise HTTPException(status_code=404, detail="Camera video not found")
    return FileResponse(path, media_type="video/mp4")


@app.post("/api/simulate")
async def simulate(request: ScenarioRequest) -> dict:
    snapshot = state_service.snapshot()
    try:
        result = await run_in_threadpool(simulation_engine.run, request.scenario_id, snapshot["zones"],
            snapshot["gates"], request.steps, request.target)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    state_service.set_simulation(result)
    return result


@app.post("/api/simulation/clear")
def clear_simulation() -> dict:
    state_service.set_simulation(None)
    return {"ok": True}


@app.post("/api/gates/{gate_id}/{gate_state}")
def update_gate(gate_id: str, gate_state: str) -> dict:
    state = state_service.snapshot()
    normalized = gate_state.upper()
    if gate_id not in state["gates"]:
        raise HTTPException(status_code=404, detail=f"Unknown gate: {gate_id}")
    if normalized not in {"OPEN", "CLOSED", "RESTRICTED"}:
        raise HTTPException(status_code=422, detail="Gate state must be OPEN, CLOSED, or RESTRICTED")
    gates = dict(state["gates"])
    gates[gate_id] = normalized
    state_service.set_gates(gates)
    return {"gate_id": gate_id, "state": normalized, "mode": "software graph only; no hardware control"}


@app.websocket("/ws/live")
async def live_state(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(state_service.snapshot())
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        log.warning("WebSocket client ended: %s", exc)


@app.get("/{frontend_path:path}", include_in_schema=False)
def serve_dashboard(frontend_path: str) -> FileResponse:
    """Serve the built Vite SPA and let React Router handle nested dashboard paths."""
    if frontend_path.startswith(("api/", "media/")) or frontend_path in {"health", "ws"}:
        raise HTTPException(status_code=404, detail="Not found")
    frontend_dir = ROOT / "frontend" / "dist"
    index = frontend_dir / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="Dashboard is not built. Run scripts/setup_demo.ps1.")
    candidate = (frontend_dir / frontend_path).resolve() if frontend_path else index.resolve()
    if candidate.is_relative_to(frontend_dir.resolve()) and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(index)
