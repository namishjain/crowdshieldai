from __future__ import annotations

import logging
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

log = logging.getLogger("crowdshield.database")


class DatabaseUnavailable(RuntimeError):
    """Raised when PostgreSQL history is requested but cannot be read."""


class DatabaseService:
    """Optional PostgreSQL history store with queued writes off the CV workers."""

    def __init__(self, database_url: str | None = None):
        self.database_url = database_url.strip() if database_url and database_url.strip() else None
        if self.database_url and self.database_url.startswith("postgres://"):
            self.database_url = "postgresql://" + self.database_url.removeprefix("postgres://")
        self.session_id = uuid4().hex
        self._queue: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=10_000)
        self._stop = threading.Event()
        self._worker: threading.Thread | None = None
        self._lock = threading.Lock()
        self._status = "disabled" if not self.database_url else "not_started"
        self._last_error: str | None = None
        self._dropped_records = 0

    def start(self) -> None:
        if not self.database_url or (self._worker and self._worker.is_alive()):
            return
        self._stop.clear()
        self._set_status("connecting", None)
        self._worker = threading.Thread(target=self._run, name="postgres-writer", daemon=True)
        self._worker.start()

    def stop(self) -> None:
        self._stop.set()
        if self._worker:
            self._worker.join(timeout=5)

    def status(self) -> dict[str, Any]:
        with self._lock:
            status = self._status
            last_error = self._last_error
            dropped = self._dropped_records
        return {
            "enabled": self.database_url is not None,
            "connected": status == "connected",
            "status": status,
            "queued_records": self._queue.qsize(),
            "dropped_records": dropped,
            "last_error": last_error,
        }

    def enqueue_measurement(self, camera: dict[str, Any]) -> None:
        # Keep aggregate telemetry only; temporary track IDs and image coordinates are not persisted.
        metrics = {key: value for key, value in camera.items()
                   if key not in {"tracks", "video_url", "message"}}
        self._enqueue({
            "kind": "measurement",
            "record_id": uuid4().hex,
            "recorded_at": datetime.now(timezone.utc),
            "camera": metrics,
        })

    def enqueue_event(self, event: dict[str, Any]) -> None:
        self._enqueue({"kind": "event", "event": event})

    def enqueue_simulation(self, result: dict[str, Any]) -> None:
        self._enqueue({
            "kind": "simulation",
            "record_id": uuid4().hex,
            "recorded_at": datetime.now(timezone.utc),
            "result": result,
        })

    def _enqueue(self, record: dict[str, Any]) -> None:
        if not self.database_url:
            return
        if record["kind"] == "event":
            timestamp = record["event"].get("timestamp")
            record["recorded_at"] = self._parse_timestamp(timestamp)
        try:
            self._queue.put_nowait(record)
        except queue.Full:
            with self._lock:
                self._dropped_records += 1
            log.error("PostgreSQL write queue is full; one %s record was dropped", record["kind"])

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.now(timezone.utc)

    def _set_status(self, status: str, error: str | None) -> None:
        with self._lock:
            self._status = status
            self._last_error = error

    def _connect(self) -> psycopg.Connection:
        assert self.database_url is not None
        connection = psycopg.connect(self.database_url, connect_timeout=3,
                                     autocommit=True, row_factory=dict_row)
        statements = (
            """CREATE TABLE IF NOT EXISTS crowdshield_measurements (
                record_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                recorded_at TIMESTAMPTZ NOT NULL,
                camera_id TEXT NOT NULL,
                zone_id TEXT,
                count INTEGER,
                risk_score DOUBLE PRECISION,
                risk_state TEXT,
                flow_rate_per_minute DOUBLE PRECISION,
                inbound_per_minute DOUBLE PRECISION,
                outbound_per_minute DOUBLE PRECISION,
                entry_count INTEGER NOT NULL DEFAULT 0,
                exit_count INTEGER NOT NULL DEFAULT 0,
                metrics JSONB NOT NULL
            )""",
            "CREATE INDEX IF NOT EXISTS ix_crowdshield_measurements_camera_time "
            "ON crowdshield_measurements (camera_id, recorded_at DESC)",
            """CREATE TABLE IF NOT EXISTS crowdshield_events (
                event_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                recorded_at TIMESTAMPTZ NOT NULL,
                event_type TEXT NOT NULL,
                zone_id TEXT,
                risk_score DOUBLE PRECISION,
                action TEXT NOT NULL,
                reason TEXT NOT NULL,
                payload JSONB NOT NULL
            )""",
            "CREATE INDEX IF NOT EXISTS ix_crowdshield_events_time "
            "ON crowdshield_events (recorded_at DESC)",
            """CREATE TABLE IF NOT EXISTS crowdshield_simulations (
                simulation_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                recorded_at TIMESTAMPTZ NOT NULL,
                scenario_label TEXT NOT NULL,
                payload JSONB NOT NULL
            )""",
            "CREATE INDEX IF NOT EXISTS ix_crowdshield_simulations_time "
            "ON crowdshield_simulations (recorded_at DESC)",
        )
        try:
            for statement in statements:
                connection.execute(statement)
        except Exception:
            connection.close()
            raise
        return connection

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                connection = self._connect()
                self._set_status("connected", None)
                log.info("Connected to PostgreSQL; history schema is ready")
            except Exception as exc:
                self._set_status("disconnected", "PostgreSQL is unreachable; check the service, database URL, and credentials.")
                log.warning("PostgreSQL is not ready; retrying in 5 seconds (%s)", exc)
                self._stop.wait(5)
                continue

            try:
                while not self._stop.is_set():
                    try:
                        record = self._queue.get(timeout=0.5)
                    except queue.Empty:
                        continue
                    try:
                        self._write(connection, record)
                        self._set_status("connected", None)
                    except (psycopg.OperationalError, psycopg.InterfaceError) as exc:
                        # Preserve the current item for an idempotent retry after reconnect.
                        try:
                            self._queue.put_nowait(record)
                        except queue.Full:
                            with self._lock:
                                self._dropped_records += 1
                        self._set_status("disconnected", "PostgreSQL connection was lost; retrying.")
                        log.warning("PostgreSQL connection lost (%s)", exc)
                        break
                    except Exception:
                        log.exception("Could not save a PostgreSQL history record")
                        with self._lock:
                            self._dropped_records += 1
                    finally:
                        self._queue.task_done()
            finally:
                connection.close()
            if not self._stop.is_set():
                self._stop.wait(2)
        self._set_status("stopped" if self.database_url else "disabled", None)

    def _write(self, connection: psycopg.Connection, record: dict[str, Any]) -> None:
        kind = record["kind"]
        if kind == "measurement":
            camera = record["camera"]
            connection.execute(
                """INSERT INTO crowdshield_measurements
                   (record_id, session_id, recorded_at, camera_id, zone_id, count, risk_score,
                    risk_state, flow_rate_per_minute, inbound_per_minute, outbound_per_minute,
                    entry_count, exit_count, metrics)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (record_id) DO NOTHING""",
                (record["record_id"], self.session_id, record["recorded_at"],
                 camera.get("camera_id", "unknown"), camera.get("zone_id"), camera.get("count"),
                 camera.get("risk_score"), camera.get("risk_state"), camera.get("flow_rate_per_minute"),
                 camera.get("inbound_per_minute"), camera.get("outbound_per_minute"),
                 camera.get("entry_count", 0), camera.get("exit_count", 0), Jsonb(camera)),
            )
        elif kind == "event":
            event = record["event"]
            connection.execute(
                """INSERT INTO crowdshield_events
                   (event_id, session_id, recorded_at, event_type, zone_id, risk_score, action, reason, payload)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (event_id) DO NOTHING""",
                (event["event_id"], self.session_id, record["recorded_at"], event["type"],
                 event.get("zone_id"), event.get("risk_score"), event["action"], event["reason"], Jsonb(event)),
            )
        elif kind == "simulation":
            result = record["result"]
            connection.execute(
                """INSERT INTO crowdshield_simulations
                   (simulation_id, session_id, recorded_at, scenario_label, payload)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (simulation_id) DO NOTHING""",
                (record["record_id"], self.session_id, record["recorded_at"],
                 str(result.get("scenario_label", result.get("scenario_id", "Scenario"))), Jsonb(result)),
            )

    def _read(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        if not self.database_url:
            raise DatabaseUnavailable("PostgreSQL is not configured. Set CROWDSHIELD_DATABASE_URL in .env.")
        if self.status()["status"] != "connected":
            raise DatabaseUnavailable("PostgreSQL is not connected. Check its Windows service and connection settings.")
        try:
            with psycopg.connect(self.database_url, connect_timeout=2, row_factory=dict_row) as connection:
                rows = connection.execute(sql, params).fetchall()
            for row in rows:
                for key, value in row.items():
                    if isinstance(value, datetime):
                        row[key] = value.isoformat()
            return rows
        except Exception as exc:
            raise DatabaseUnavailable("Could not read PostgreSQL history. Check the database connection.") from exc

    def history_measurements(self, camera_id: str | None, limit: int) -> list[dict[str, Any]]:
        if camera_id:
            sql = """SELECT record_id, session_id, recorded_at, camera_id, zone_id, count, risk_score,
                      risk_state, flow_rate_per_minute, inbound_per_minute, outbound_per_minute,
                      entry_count, exit_count, metrics
                      FROM crowdshield_measurements WHERE camera_id = %s
                      ORDER BY recorded_at DESC LIMIT %s"""
            rows = self._read(sql, (camera_id, limit))
        else:
            sql = """SELECT record_id, session_id, recorded_at, camera_id, zone_id, count, risk_score,
                      risk_state, flow_rate_per_minute, inbound_per_minute, outbound_per_minute,
                      entry_count, exit_count, metrics
                      FROM crowdshield_measurements ORDER BY recorded_at DESC LIMIT %s"""
            rows = self._read(sql, (limit,))
        return list(reversed(rows))

    def history_events(self, limit: int) -> list[dict[str, Any]]:
        rows = self._read(
            """SELECT event_id, session_id, recorded_at, event_type, zone_id, risk_score, action, reason, payload
               FROM crowdshield_events ORDER BY recorded_at DESC LIMIT %s""", (limit,))
        return list(reversed(rows))

    def history_simulations(self, limit: int) -> list[dict[str, Any]]:
        rows = self._read(
            """SELECT simulation_id, session_id, recorded_at, scenario_label, payload
               FROM crowdshield_simulations ORDER BY recorded_at DESC LIMIT %s""", (limit,))
        return list(reversed(rows))
