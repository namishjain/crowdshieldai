from __future__ import annotations

from typing import Any

import networkx as nx
from mesa import Agent, Model

from backend.app.recommendations.engine import RecommendationEngine
from backend.app.risk.engine import RiskEngine, clamp
from backend.app.routing.planner import RoutePlanner


class CrowdAgent(Agent):
    """Anonymous simulated person; no identity or cross-camera association."""

    def __init__(self, model: Model, node: str):
        super().__init__(model)
        self.node = node
        self.evacuated = False


class CrowdFlowModel(Model):
    def __init__(self, counts: dict[str, int], graph: nx.Graph, exits: set[str], steps: int, step_seconds: int = 15):
        super().__init__(rng=17)
        self.cycle = 0
        self.graph = graph
        self.exits = exits
        self.max_steps = steps
        self.step_seconds = step_seconds
        self.evacuated_count = 0
        self.initial_count = sum(counts.values())
        for node, count in counts.items():
            for _ in range(max(0, int(count))):
                CrowdAgent(self, node)

    def step(self) -> None:
        if self.cycle >= self.max_steps:
            return
        active = [agent for agent in self.agents if not agent.evacuated]
        occupancy: dict[str, int] = {}
        for agent in active:
            occupancy[agent.node] = occupancy.get(agent.node, 0) + 1
        self.random.shuffle(active)
        remaining_capacity: dict[tuple[str, str], int] = {}
        for agent in active:
            if agent.node in self.exits:
                agent.evacuated = True
                self.evacuated_count += 1
                continue
            choices: list[tuple[float, str, tuple[str, str]]] = []
            for neighbor in self.graph.neighbors(agent.node):
                edge = self.graph[agent.node][neighbor]
                key = tuple(sorted((agent.node, neighbor)))
                if key not in remaining_capacity:
                    remaining_capacity[key] = max(0, int(float(edge["capacity_per_minute"]) * self.step_seconds / 60))
                if remaining_capacity[key] <= 0:
                    continue
                distances: list[float] = []
                for exit_node in self.exits:
                    try:
                        distances.append(float(nx.shortest_path_length(self.graph, neighbor, exit_node, weight="cost")))
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        continue
                rest = min(distances, default=1e9)
                congestion = occupancy.get(neighbor, 0) / max(1.0, float(edge["capacity_per_minute"]))
                choices.append((float(rest) + congestion * 3, neighbor, key))
            if choices:
                _, destination, key = min(choices)
                remaining_capacity[key] -= 1
                agent.node = destination
        self.cycle += 1
        self.steps += 1


class SimulationEngine:
    def __init__(self, venue_config: dict[str, Any], routing_config: dict[str, Any], risk_engine: RiskEngine,
                 recommendation_engine: RecommendationEngine, scenarios_config: dict[str, Any]):
        self.venue = venue_config["venue"]
        self.planner = RoutePlanner(venue_config, routing_config)
        self.risk_engine = risk_engine
        self.recommender = recommendation_engine
        self.routing_config = routing_config
        self.scenarios = {s["id"]: s for s in scenarios_config["scenarios"]}

    def run(self, scenario_id: str, zones: list[dict[str, Any]], gates: dict[str, str], steps: int = 10,
            target: str | None = None) -> dict[str, Any]:
        if scenario_id not in self.scenarios:
            raise ValueError(f"Unknown scenario '{scenario_id}'")
        scenario = dict(self.scenarios[scenario_id])
        if target:
            scenario["target"] = target
        by_id = {str(zone["zone_id"]): dict(zone) for zone in zones if zone.get("count") is not None}
        if not by_id:
            raise ValueError("What-if simulation needs measured camera counts; no camera metrics are available yet.")
        zone_nodes = {str(item["id"]): str(item["node"]) for item in self.venue["zones"]}
        # Camera views overlap. For model initialization use the maximum observed count per configured graph node,
        # never a sum across views. The resulting people are simulation agents, not venue-wide unique identities.
        counts: dict[str, int] = {}
        risk_by_node: dict[str, float] = {}
        for zone_id, zone in by_id.items():
            node = zone_nodes.get(zone_id)
            if node:
                counts[node] = max(counts.get(node, 0), int(zone["count"]))
                risk_by_node[node] = max(risk_by_node.get(node, 0.0), float(zone.get("risk_score") or 0))
        baseline_counts = dict(counts)
        if scenario["type"] == "crowd_surge":
            node = str(scenario["target"])
            counts[node] = int(round(counts.get(node, 0) * 1.3)) + (8 if counts.get(node, 0) == 0 else 0)
        gate_after = dict(gates)
        blocked_exits: set[str] = set()
        hazard = 0.0
        capacity_scale = 1.0
        if scenario["type"] == "close_gate":
            gate_after[str(scenario["target"])] = "CLOSED"
        elif scenario["type"] == "open_gate":
            gate_after[str(scenario["target"])] = "OPEN"
        elif scenario["type"] == "block_exit":
            blocked_exits.add(str(scenario["target"]))
        elif scenario["type"] in {"emergency", "medical"}:
            hazard = 28.0 if scenario["type"] == "emergency" else 10.0
        elif scenario["type"] == "power_failure":
            gate_after["GATE_C"] = "CLOSED"
            capacity_scale = 0.55
        elif scenario["type"] == "heavy_rain":
            capacity_scale = 0.72

        before_gate_states = dict(gates)
        zone_risks: dict[str, float] = {}
        zone_counts: dict[str, int] = {}
        for zone_id, zone in by_id.items():
            node = zone_nodes.get(zone_id)
            if node:
                zone_risks[node] = max(zone_risks.get(node, 0.0), float(zone.get("risk_score") or 0))
                zone_counts[node] = max(zone_counts.get(node, 0), int(zone["count"]))
        for node, count in counts.items():
            zone_counts[node] = max(zone_counts.get(node, 0), count)
        hottest_zone = max(by_id.values(), key=lambda z: float(z.get("risk_score") or 0))
        target_node = str(scenario["target"])
        focused_zone = next((zone for zone_id, zone in by_id.items()
                             if zone_nodes.get(zone_id) == target_node), hottest_zone)
        start = zone_nodes.get(str(focused_zone["zone_id"]), "CENTRAL")
        baseline_total = sum(baseline_counts.values())
        total_count = sum(counts.values())
        before_route = self.planner.calculate(start, gate_states=before_gate_states, zone_risk=zone_risks,
            zone_count=zone_counts, total_people=baseline_total)
        after_graph = self.planner.graph(gate_after, zone_risks, zone_counts, blocked_exits,
                                         capacity_scale=capacity_scale)
        active_exits = set(self.venue["exits"]) - blocked_exits
        # Agent routing targets every usable exit, selecting the nearest by the same configured path cost.
        sim = CrowdFlowModel(counts, after_graph, active_exits, steps=max(1, min(60, steps)))
        for _ in range(sim.max_steps):
            sim.step()
        after_route = self.planner.calculate(start, gate_states=gate_after, zone_risk=zone_risks,
            zone_count=zone_counts, blocked_exits=blocked_exits, total_people=total_count,
            capacity_scale=capacity_scale)
        base_score = float(focused_zone.get("risk_score") or 0)
        count_effect = max(0, counts.get(start, 0) - int(focused_zone.get("count") or 0))
        capacity_effect = max(0.0, 1.0 - capacity_scale) * 20.0
        exposure = hazard + capacity_effect + min(25.0, count_effect / max(1, int(focused_zone.get("capacity") or 1)) * 25)
        after_score = clamp(base_score + exposure + max(0.0, (after_route.get("route_risk") or 0) - (before_route.get("route_risk") or 0)) * 0.25)
        after_state = self.risk_engine.classify(after_score)
        evacuate_people = sim.evacuated_count
        remaining = max(0, total_count - evacuate_people)
        estimated_evacuation = sim.cycle * sim.step_seconds / 60 + remaining / max(1.0,
            float(self.routing_config["assumptions"]["evacuation_exit_capacity_people_per_minute"]))
        recommendations = self.recommender.evaluate(after_state,
            {**focused_zone, "risk_score": after_score, "count": counts.get(start, 0)}, after_route, gate_after)
        for recommendation in recommendations:
            recommendation["simulated"] = True
        return {
            "scenario_id": scenario_id,
            "scenario_label": scenario["label"],
            "target": scenario["target"],
            "mode": "MESA_AGENT_BASED_SIMULATION",
            "baseline_source": "measured per-view camera counts; camera overlaps collapsed by graph node using max count",
            "synthetic_scenario_adjustment": scenario["type"] in {"crowd_surge", "emergency", "medical", "power_failure", "heavy_rain"},
            "before": {"risk_score": round(base_score, 2), "risk_state": self.risk_engine.classify(base_score),
                       "route": before_route, "gate_states": before_gate_states, "people_in_simulation": baseline_total},
            "after": {"risk_score": round(after_score, 2), "risk_state": after_state,
                      "route": after_route, "gate_states": gate_after,
                      "people_in_simulation": total_count, "agents_evacuated_in_steps": evacuate_people,
                      "steps": sim.cycle, "step_duration_seconds": sim.step_seconds,
                      "estimated_remaining_evacuation_minutes": round(estimated_evacuation, 2),
                      "exposure_adjustment_points": round(exposure, 2)},
            "recommendations": recommendations,
            "limitations": "Illustrative graph, capacities, walking speed and agent rules; not a certified evacuation model or hardware command.",
        }
