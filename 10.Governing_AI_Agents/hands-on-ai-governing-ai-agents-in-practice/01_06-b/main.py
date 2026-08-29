"""
Lesson 6: Evaluate Agent Readiness 

Steps: Run main.py first, then readiness_check.py

-readiness_check.py flags 
--inventory 01_06-b/inventory/agent_inventory.json --log 01_06-b/logs/agent_events.jsonl

Goal:
- Produce a READY / NOT READY decision using:
  1) Agent Inventory
  2) Recent Agent Logs

This mirrors a production gate in CI/CD without introducing
any new governance artifacts.
"""

import os
import asyncio
import json
from datetime import datetime, timezone

from dotenv import load_dotenv, find_dotenv
from openai import OpenAI
from agents import Runner, InputGuardrail, InputGuardrailTripwireTriggered

from agent_io import load_inventory, save_inventory, inventory_exists
from observability import ensure_dirs, log_event, summarize_run, RUN_ID
from agent_definitions import shopping_agent, set_event_log_path, research_agent
from guardrails import runtime_guardrail


# ---------------------------------------------------------------------------
# Env + Client
# ---------------------------------------------------------------------------
_ = load_dotenv(find_dotenv())
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = "01_06-b"
DATA_DIR = f"{BASE_DIR}/data"
OUT_DIR = f"{BASE_DIR}/out"
LOG_DIR = f"{BASE_DIR}/logs"
INV_DIR = f"{BASE_DIR}/inventory"

INPUT_PATH = os.path.join(DATA_DIR, "shopping_notes.txt")
OUTPUT_PATH = os.path.join(OUT_DIR, "shopping_summary.json")
EVENT_LOG_PATH = os.path.join(LOG_DIR, "agent_events.jsonl")
INVENTORY_PATH = os.path.join(INV_DIR, "agent_inventory.json")

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def print_guardrail_result(decision_obj) -> None:
    """
    decision_obj is GuardrailDecision (from guardrails.py) but we keep this generic.
    """
    print("\n=== Guardrail Decision ===")
    try:
        print(json.dumps(decision_obj.model_dump(), indent=2))
    except Exception:
        print(str(decision_obj))
    print("==========================\n")


async def agent_run(mode: str) -> None:
    """
    mode="allowed" runs with allowlisted paths
    mode="blocked" attempts to write outside OUT_DIR to show the guardrail tripwire
    """
    created_at = utc_now_iso()

    if mode == "allowed":
        out_path = OUTPUT_PATH
    else:
        # Intentionally bad: write outside OUT_DIR
        out_path = os.path.join(BASE_DIR, "FORBIDDEN.json")

    prompt = (
        f"Read the shopping notes at: {INPUT_PATH}. "
        "Extract the budget (if present), list key needs as short items, and write a JSON summary to: "
        f"{out_path}. "
        f'Set created_at to "{created_at}". '
        "Return the JSON."
    )

    # Add the guardrail at runtime 
    shopping_agent.input_guardrails = [InputGuardrail(guardrail_function=runtime_guardrail)]

    # Context available to guardrail function
    inventory = load_inventory(INVENTORY_PATH)
    context = {
        "inventory": inventory,
        "event_log_path": EVENT_LOG_PATH,
        "out_dir": OUT_DIR,
    }

    log_event(EVENT_LOG_PATH, "agent_run_started", agent_name=shopping_agent.name, mode=mode)

    try:
        result = await Runner.run(shopping_agent, prompt, context=context)
        log_event(EVENT_LOG_PATH, "agent_run_completed", agent_name=shopping_agent.name, mode=mode, status="ok")

        print("=== Agent Output ===")
        print(json.dumps(result.final_output.model_dump(), indent=2))
        print("====================\n")

    except InputGuardrailTripwireTriggered as e:
        # e contains the guardrail output
        log_event(EVENT_LOG_PATH, "agent_run_blocked", agent_name=shopping_agent.name, mode=mode, status="blocked")
        print("\nGuardrail blocked this run.")
        # The SDK surfaces guardrail output on the exception
        if hasattr(e, "guardrail_output") and e.guardrail_output is not None:
            print_guardrail_result(e.guardrail_output)
        else:
            print(str(e))


async def main() -> None:
    ensure_dirs(DATA_DIR, OUT_DIR, LOG_DIR, INV_DIR)
    set_event_log_path(EVENT_LOG_PATH)

    log_event(EVENT_LOG_PATH, "run_started", lesson="lesson4", run_id=RUN_ID)
    
    # Run once in allowed mode, then once in blocked mode
    await agent_run("allowed")
    await agent_run("blocked")

    summary = summarize_run(EVENT_LOG_PATH)
    log_event(EVENT_LOG_PATH, "run_completed", lesson="lesson4", status="ok", event_counts=summary)

    print("=== Audit Summary (this run) ===")
    for k in sorted(summary.keys()):
        print(f"{k}: {summary[k]}")
    print("================================\n")
    print(f"Event log: {EVENT_LOG_PATH}")
    print(f"Run ID: {RUN_ID}")


if __name__ == "__main__":
    asyncio.run(main())
