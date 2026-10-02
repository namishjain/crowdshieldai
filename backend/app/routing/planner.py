from __future__ import annotations

from typing import Any

import networkx as nx


class RoutePlanner:
    def __init__(self, venue: dict[str, Any], config: dict[str, Any]):
        self.venue = venue["venue"]
        self.config = config
        self.nodes = {item["id"]: item for item in self.venue["nodes"]}
        self.exits = list(self.venue["exits"])
        self.gates = dict(self.venue["gates"])

    def graph(self, gate_states: dict[str, str], zone_risk: dict[str, float], zone_count: dict[str, int],
               blocked_exits: set[str] | None = None, capacity_scale: float = 1.0) -> nx.Graph:
        graph = nx.Graph()
        blocked_exits = blocked_exits or set()
        for node_id, meta in self.nodes.items():
            graph.add_node(node_id, **meta)
        weights = self.config["weights"]
        for edge in self.venue["edges"]:
            gate = edge.get("gate")
            status = gate_states.get(gate, "OPEN") if gate else "OPEN"
            if status == "CLOSED" or edge["from"] in blocked_exits or edge["to"] in blocked_exits:
                continue
            start, end = edge["from"], edge["to"]
            congestion = max(zone_risk.get(start, 0.0), zone_risk.get(end, 0.0))
            count = max(zone_count.get(start, 0), zone_count.get(end, 0))
            capacity = max(1.0, float(edge["capacity_per_minute"]) * max(0.1, capacity_scale))
            congestion = min(100.0, max(congestion, count / capacity * 35.0))
            if status == "RESTRICTED":
                congestion = min(100.0, congestion + 30.0)
            distance = float(edge["distance_m"])
            edge_risk = max(zone_risk.get(start, 0.0), zone_risk.get(end, 0.0))
            congestion_cost = distance * float(weights["congestion"]) * congestion / 100.0
            risk_cost = distance * float(weights["risk"]) * edge_risk / 100.0
            travel_cost = distance / max(0.1, float(self.config["assumptions"]["walking_speed_mps"])) * float(weights["travel_time"])
            cost = distance * float(weights["distance"]) + congestion_cost + risk_cost + travel_cost
            attrs = {
                **edge,
                "status": status,
                "capacity_per_minute": capacity,
                "congestion": congestion,
                "risk": edge_risk,
                "cost": cost,
            }
            graph.add_edge(start, end, **attrs)
        return graph

    def calculate(self, start: str, *, gate_states: dict[str, str] | None = None,
                  zone_risk: dict[str, float] | None = None, zone_count: dict[str, int] | None = None,
                  blocked_exits: set[str] | None = None, total_people: int = 0,
                  capacity_scale: float = 1.0) -> dict[str, Any]:
        gates = gate_states or self.gates
        risk = zone_risk or {}
        counts = zone_count or {}
        graph = self.graph(gates, risk, counts, blocked_exits, capacity_scale)
        candidates: list[tuple[float, str, list[str]]] = []
        for exit_id in self.exits:
            if blocked_exits and exit_id in blocked_exits:
                continue
            if start not in graph or exit_id not in graph or not nx.has_path(graph, start, exit_id):
                continue
            path = nx.shortest_path(graph, start, exit_id, weight="cost")
            cost = nx.path_weight(graph, path, weight="cost")
            candidates.append((float(cost), exit_id, path))
        if not candidates:
            return {"route": [], "node_names": [], "destination": None, "total_cost": None,
                    "distance_m": None, "route_risk": None, "congestion_percent": None,
                    "estimated_travel_seconds": None, "estimated_evacuation_minutes": None,
                    "reason": "No open, connected exit is available in the current graph."}
        cost, destination, path = min(candidates)
        segments = [graph[a][b] for a, b in zip(path, path[1:])]
        distance = sum(float(edge["distance_m"]) for edge in segments)
        avg_congestion = sum(float(edge["congestion"]) for edge in segments) / max(1, len(segments))
        avg_risk = sum(float(edge["risk"]) for edge in segments) / max(1, len(segments))
        walk_speed = float(self.config["assumptions"]["walking_speed_mps"])
        travel_seconds = distance / max(0.1, walk_speed) * (1 + avg_congestion / 100)
        exit_ppm = float(self.config["assumptions"]["evacuation_exit_capacity_people_per_minute"])
        evac_minutes = max(travel_seconds / 60, total_people / max(1.0, exit_ppm))
        names = [self.nodes[node].get("name", node) for node in path]
        return {
            "route": path,
            "node_names": names,
            "destination": destination,
            "total_cost": round(cost, 2),
            "distance_m": round(distance, 1),
            "route_risk": round(avg_risk, 1),
            "congestion_percent": round(avg_congestion, 1),
            "estimated_travel_seconds": round(travel_seconds, 1),
            "estimated_evacuation_minutes": round(evac_minutes, 2),
            "reason": "Dijkstra minimizes configured distance + congestion + risk + travel-time cost over open edges.",
        }
