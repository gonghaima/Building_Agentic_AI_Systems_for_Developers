"""
Lesson 6: Evaluate Agent Readiness (Simplified)

-readiness_check.py flags 
--inventory 01_06-e/inventory/agent_inventory.json --log 01_06-e/logs/agent_events.jsonl


Goal:
- Produce a READY / NOT READY decision using:
  1) Agent Inventory
  2) Recent Agent Logs

This mirrors a production gate in CI/CD 
"""

import argparse
import json
from collections import Counter, defaultdict
from typing import Any


# ---------------------------------------------------------------------------
# Load helpers
# ---------------------------------------------------------------------------
def load_json(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_jsonl(path: str) -> list[dict[str, Any]]:
    events = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events


def get_last_run_id(events: list[dict[str, Any]]) -> str | None:
    for e in reversed(events):
        if "run_id" in e:
            return e["run_id"]
    return None


def filter_run(events: list[dict[str, Any]], run_id: str) -> list[dict[str, Any]]:
    return [e for e in events if e.get("run_id") == run_id]


# ---------------------------------------------------------------------------
# Inventory checks
# ---------------------------------------------------------------------------
def check_inventory_completeness(inventory: dict[str, Any]) -> list[str]:
    failures = []
    required_fields = {
        "owner",
        "risk_level",
        "environments",
        "tool_access",
        "data_access",
    }

    for agent in inventory.get("agents", []):
        name = agent.get("name", "unknown agent")
        missing = [f for f in required_fields if f not in agent]
        if missing:
            failures.append(
                f'Inventory incomplete for "{name}" (missing: {", ".join(missing)})'
            )

    return failures


# ---------------------------------------------------------------------------
# Log-based checks
# ---------------------------------------------------------------------------
def check_guardrail_blocks(run_events: list[dict[str, Any]]) -> list[str]:
    failures = []
    for e in run_events:
        if e.get("event_type") == "guardrail_blocked":
            agent = e.get("agent_name", "unknown agent")
            decision = e.get("decision", {})
            reason = decision.get("reason", "") if isinstance(decision, dict) else ""
            failures.append(
                f'Guardrail blocked an action for "{agent}". {reason}'.strip()
            )
    return failures


def check_tool_anomalies(run_events: list[dict[str, Any]]) -> list[str]:
    failures = []

    invoked = Counter()
    completed = Counter()

    for e in run_events:
        if e.get("event_type") == "tool_invoked":
            invoked[e.get("tool_name", "unknown_tool")] += 1
        if e.get("event_type") == "tool_completed":
            completed[e.get("tool_name", "unknown_tool")] += 1

    for tool, count in invoked.items():
        if completed.get(tool, 0) < count:
            failures.append(
                f'Tool "{tool}" invoked {count} times but completed {completed.get(tool, 0)} times'
            )

    return failures


def check_high_risk_agent_behavior(
    inventory: dict[str, Any],
    run_events: list[dict[str, Any]],
) -> list[str]:
    failures = []

    inventory_by_name = {
        a["name"]: a for a in inventory.get("agents", [])
    }

    for e in run_events:
        if e.get("event_type") != "tool_invoked":
            continue

        agent_name = e.get("agent_name")
        tool_name = str(e.get("tool_name", "")).lower()

        if not agent_name or agent_name not in inventory_by_name:
            continue

        agent = inventory_by_name[agent_name]
        risk = agent.get("risk_level")

        if risk == "high" and ("web" in tool_name or "search" in tool_name):
            if not agent.get("requires_human_review", False):
                failures.append(
                    f'High-risk agent "{agent_name}" used web/search without human review enabled'
                )

    return failures


# ---------------------------------------------------------------------------
# Main readiness gate
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", required=True, help="agent_inventory.json")
    ap.add_argument("--log", required=True, help="agent_events.jsonl")
    ap.add_argument("--run-id", default=None)
    args = ap.parse_args()

    inventory = load_json(args.inventory)
    events = load_jsonl(args.log)

    run_id = args.run_id or get_last_run_id(events)
    if not run_id:
        print("NOT READY")
        print("Reason: No run_id found in logs.")
        return

    run_events = filter_run(events, run_id)

    reasons = []
    reasons += check_inventory_completeness(inventory)
    reasons += check_guardrail_blocks(run_events)
    reasons += check_tool_anomalies(run_events)
    reasons += check_high_risk_agent_behavior(inventory, run_events)

    is_ready = len(reasons) == 0

    print("READY" if is_ready else "NOT READY")
    print(f"Run: {run_id}")

    print("\nReasons:")
    if reasons:
        for r in reasons:
            print(" -", r)
    else:
        print(" - All checks passed.")

    counts = Counter(e.get("event_type", "unknown") for e in run_events)
    print("\nRun summary:")
    for k, v in counts.items():
        print(f" - {k}: {v}")


if __name__ == "__main__":
    main()