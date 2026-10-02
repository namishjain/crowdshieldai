from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}


class RecommendationEngine:
    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.thresholds = config["thresholds"]

    @staticmethod
    def _item(action_type: str, priority: str, target: str, reason: str, expected: str, zone_id: str | None = None) -> dict[str, Any]:
        seed = f"{action_type}:{target}:{zone_id or ''}"
        return {
            "action_id": seed,
            "action_type": action_type,
            "priority": priority,
            "target": target,
            "reason": reason,
            "expected_effect": expected,
            "source_zone": zone_id,
            "timestamp": datetime.now(timezone.utc),
            "simulated": False,
        }

    def evaluate(self, state: str, hot_zone: dict[str, Any] | None, route: dict[str, Any], gates: dict[str, str]) -> list[dict[str, Any]]:
        if state == "NO_DATA" or not hot_zone:
            return []
        zone_id = str(hot_zone.get("zone_id", "unknown"))
        score = float(hot_zone.get("risk_score") or 0)
        count = int(hot_zone.get("count") or 0)
        capacity = max(1, int(hot_zone.get("capacity") or 1))
        slope = float(hot_zone.get("trend_people_per_minute") or 0)
        items: list[dict[str, Any]] = []
        if state == "SAFE":
            return []
        if state == "WARNING":
            if slope >= float(self.thresholds["warning_trend_people_per_minute"]):
                items.append(self._item("INCREASE_MONITORING", "MEDIUM", zone_id,
                    f"The tracked count is rising at {slope:.1f} people/min in this view while risk is {score:.1f}.",
                    "Give the operator an earlier look at the changing zone.", zone_id))
            else:
                items.append(self._item("MONITOR", "LOW", zone_id,
                    f"The measured view is in WARNING at {score:.1f}; no rising count trend has been measured.",
                    "Keep observing before applying a stronger intervention.", zone_id))
        if state == "HIGH":
            if route.get("destination"):
                items.append(self._item("REDIRECT_FLOW", "HIGH", route["destination"],
                    f"Zone {zone_id} is HIGH at {score:.1f}; the current safety-aware route ends at {route['destination']}.",
                    "Guide new movement along the currently lower-cost open route.", zone_id))
            if self.config["resource_rules"].get("security_on_high"):
                n = int(self.config["resource_rules"]["security_team_count"])
                items.append(self._item("DEPLOY_SECURITY", "HIGH", zone_id,
                    f"Risk is HIGH and the configured response rule calls for {n} security teams at the affected view.",
                    "Place staff where operators can observe and manage local flow.", zone_id))
        if state == "CRITICAL":
            feeding_gate = hot_zone.get("feeding_gate")
            if feeding_gate and gates.get(feeding_gate) == "OPEN" and hot_zone.get("safe_to_close_gate"):
                items.append(self._item("CLOSE_GATE", "CRITICAL", str(feeding_gate),
                    f"Gate {feeding_gate} feeds {zone_id}, whose measured view count ({count}) reached demo capacity ({capacity}); an alternate route remains available in the graph.",
                    "Reduce new inflow toward the affected zone while preserving a modeled exit route.", zone_id))
            elif count >= capacity:
                items.append(self._item("RESTRICT_INFLOW", "CRITICAL", zone_id,
                    f"The view count ({count}) has reached the configured demo capacity ({capacity}).",
                    "Reduce additional inflow into the saturated demo zone.", zone_id))
            open_alt = next((gate for gate, status in gates.items() if gate != "GATE_A" and status != "OPEN"), None)
            if open_alt:
                items.append(self._item("OPEN_GATE", "CRITICAL", open_alt,
                    f"Zone {zone_id} is CRITICAL at {score:.1f}; {open_alt} is configured as an available alternate gate.",
                    "Add a route option in the software graph for operator review.", zone_id))
            items.append(self._item("ISSUE_PUBLIC_ADVISORY", "CRITICAL", zone_id,
                f"Measured risk is CRITICAL at {score:.1f}; the system has detected a view-level overload condition.",
                "Prepare a concise crowd-flow advisory for human approval.", zone_id))
            if self.config["resource_rules"].get("medical_on_critical"):
                n = int(self.config["resource_rules"]["medical_team_count"])
                items.append(self._item("PREPARE_MEDICAL_TEAM", "HIGH", zone_id,
                    "Critical crowd risk warrants preparing medical response under the configured demo rule.",
                    f"Stage {n} medical team(s) near the affected view; this is a recommendation, not dispatch.", zone_id))
            items.append(self._item("DEPLOY_SECURITY", "CRITICAL", zone_id,
                f"The zone is CRITICAL and tracked count is {count} against demo capacity {capacity}.",
                "Assign human operators to manage access and observe the area.", zone_id))
            if route.get("destination"):
                items.append(self._item("REROUTE", "CRITICAL", route["destination"],
                    f"Dijkstra selected {route['destination']} using current open gates and configured risk/congestion costs.",
                    "Direct flow toward the selected lower-cost route for operator review.", zone_id))
        if state in {"HIGH", "CRITICAL"} and float(route.get("route_risk") or 0) >= float(self.thresholds["route_risk_percent"]):
            items.append(self._item("RECALCULATE_ROUTE", "HIGH", zone_id,
                f"The selected route still carries {float(route['route_risk']):.0f}% averaged view risk.",
                "Operator should inspect other open exits and gate availability.", zone_id))
        # Identical actions are represented once and the strongest priority is kept.
        unique: dict[str, dict[str, Any]] = {}
        for item in items:
            old = unique.get(item["action_id"])
            if old is None or PRIORITY_ORDER[item["priority"]] < PRIORITY_ORDER[old["priority"]]:
                unique[item["action_id"]] = item
        return sorted(unique.values(), key=lambda x: PRIORITY_ORDER[x["priority"]])
