"""
Lesson 5: Detect and Log Agent Actions (Simple)

- audit log flags: --log 01_05-b/logs/agent_events.jsonl

Goal:
- Turn agent logs into governance signals:
  - violations
  - risky tool usage
  - basic anomalies

Usage:
  python audit_logs.py --log 01_05-b/logs/agent_events.jsonl
"""
#TODO: import argparser
import json
from collections import defaultdict, Counter


VIOLATION_EVENTS = {"guardrail_blocked", "agent_run_blocked"}
RISKY_TOOL_KEYWORDS = ("write", "delete", "remove", "update")
WEB_TOOL_KEYWORDS = ("web", "search", "http")


def load_jsonl(path: str) -> list[dict]:
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


def is_risky_tool(tool_name: str) -> bool:
    t = tool_name.lower()
    return any(k in t for k in RISKY_TOOL_KEYWORDS)


def is_web_tool(tool_name: str) -> bool:
    t = tool_name.lower()
    return any(k in t for k in WEB_TOOL_KEYWORDS)


def main():
    #TODO: Add an argument parser that reads the log file during runtime.

    #TODO: Load the file into an events variable.

    # group events by run_id
    runs: dict[str, list[dict]] = defaultdict(list)
    for e in events:
        run_id = e.get("run_id")
        if run_id:
            runs[run_id].append(e)

    print(f"\nRuns found: {len(runs)}\n")

    for run_id, evts in runs.items():
        counts = Counter(e.get("event_type", "unknown") for e in evts)

        # signals we want to surface
        violations: list[str] = []
        risky_tools: set[str] = set()
        invoked: Counter[str] = Counter()
        completed: Counter[str] = Counter()

        for e in evts:
            et = e.get("event_type", "unknown")

            if et in VIOLATION_EVENTS:
                agent = e.get("agent_name", "unknown agent")
                decision = e.get("decision", {})
                reason = ""
                rule = ""

                if isinstance(decision, dict):
                    reason = decision.get("reason", "")
                    rule = decision.get("matched_rule", "")

                msg = f"{et} by {agent}"
                if rule:
                    msg += f" (rule={rule})"
                if reason:
                    msg += f": {reason}"
                violations.append(msg)

            if et == "tool_invoked":
                tool = str(e.get("tool_name", "unknown_tool"))
                invoked[tool] += 1
                if is_risky_tool(tool) or is_web_tool(tool):
                    risky_tools.add(tool)

            if et == "tool_completed":
                tool = str(e.get("tool_name", "unknown_tool"))
                completed[tool] += 1

        # basic anomaly: tool invoked but never completed
        anomalies: list[str] = []
        for tool, n_invoked in invoked.items():
            n_done = completed.get(tool, 0)
            if n_done < n_invoked:
                anomalies.append(f"{tool} invoked={n_invoked} completed={n_done}")

        # print a compact audit view
        print("========================================")
        print(f"Run: {run_id}")
        print("Event counts:", dict(counts))

        print("\nViolations:")
        if violations:
            for v in violations:
                print(" -", v)
        else:
            print(" - none")

        print("\nRisky tool usage:")
        if risky_tools:
            for t in sorted(risky_tools):
                print(" -", t)
        else:
            print(" - none")

        print("\nAnomalies:")
        if anomalies:
            for a in anomalies:
                print(" -", a)
        else:
            print(" - none")

        print("========================================\n")


if __name__ == "__main__":
    main()
