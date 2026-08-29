"""
Lesson 3: Create an Agent Inventory

Steps: Run main.py

Goal:
- Create a structured inventory that lists your agents, their tools, and their access footprint
- Introduce a second agent that uses WebSearchTool
- Log key events (inventory loaded, agent runs, tool usage) to a JSONL audit log

Prereqs:
  pip install -r requirements.txt
  export OPENAI_API_KEY="..."   (or set in .env)
"""

import os
import asyncio
import json
from datetime import datetime, timezone

from dotenv import load_dotenv, find_dotenv
from openai import OpenAI
from agents import Runner

from agent_models import (
    AgentInventory,
    AgentInventoryItem,
    ToolAccess,
    DataAccess,
    RiskLevel,
)

from agent_io import load_inventory, save_inventory, inventory_exists
from agent_definitions import shopping_agent, research_agent, set_event_log_path
from observability import ensure_dirs, log_event, summarize_run, RUN_ID

# ---------------------------------------------------------------------------
# Env + Client
# ---------------------------------------------------------------------------
_ = load_dotenv(find_dotenv())
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# ---------------------------------------------------------------------------
# Local demo files
# ---------------------------------------------------------------------------
BASE_DIR = "01_03-b"
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


def build_default_inventory() -> AgentInventory:
    return AgentInventory(
        description="Starter agent inventory for governing agent behavior in an environment.",
        agents=[
            AgentInventoryItem(
                agent_id="agent.shopping.v1",
                name=shopping_agent.name,
                purpose="Reads shopping notes and writes a structured JSON summary to disk.",
                owner="AI Platform Team",
                environments=["dev"],
                #TODO: Define the risk level 
                tool_access=[
                    ToolAccess(name="read_local_text", type="function_tool", notes="Reads local notes file"),
                    ToolAccess(name="write_local_json", type="function_tool", notes="Writes summary JSON to disk"),
                ],
                data_access=DataAccess(
                    reads=[INPUT_PATH],
                    writes=[OUTPUT_PATH],
                ),
                requires_human_review=False,
                review_triggers=[
                    "Attempts to write outside the out directory",
                    "Attempts to access files not listed in inventory",
                ],
            ),
            AgentInventoryItem(
                agent_id="agent.research.v1",
                name=research_agent.name,
                purpose="Uses web search to validate product choices or provide current guidance.",
                owner="AI Platform Team",
                environments=["dev"],
                #TODO: Define the risk level 
                tool_access=[
                    ToolAccess(name="WebSearchTool", type="web_search", notes="Queries the internet for current info"),
                ],
                data_access=DataAccess(reads=[], writes=[]),
                requires_human_review=False,
                review_triggers=[
                    "Returns sources that look non-credible",
                    "Attempts to make purchasing decisions directly",
                ],
            ),
        ],
    )


def print_inventory(inv: AgentInventory) -> None:
    print("\n=== Agent Inventory ===")
    print(inv.description)
    print(f"Agents: {len(inv.agents)}\n")
    for a in inv.agents:
        print(f"- {a.name} ({a.agent_id})")
        print(f"  Purpose: {a.purpose}")
        print(f"  Environments: {', '.join(a.environments)}")
        print(f"  Risk: {a.risk_level}")
        print("  Tools:")
        for t in a.tool_access:
            print(f"    - {t.name} ({t.type})")
        if a.data_access.reads or a.data_access.writes:
            print("  Data access:")
            if a.data_access.reads:
                print(f"    Reads: {a.data_access.reads}")
            if a.data_access.writes:
                print(f"    Writes: {a.data_access.writes}")
        print("")
    print("=======================\n")


async def run_shopping_agent(created_at: str) -> None:
    prompt = (
        f"Read the shopping notes at: {INPUT_PATH}. "
        "Extract the budget (if present), list key needs as short items, and write a JSON summary to: "
        f"{OUTPUT_PATH}. "
        f'Set created_at to "{created_at}". '
        "Return the JSON."
    )

    log_event(EVENT_LOG_PATH, "agent_run_started", agent_name=shopping_agent.name, created_at=created_at)
    result = await Runner.run(shopping_agent, prompt)
    log_event(EVENT_LOG_PATH, "agent_run_completed", agent_name=shopping_agent.name, status="ok")

    print("=== Shopping Agent Output ===")
    print(json.dumps(result.final_output.model_dump(), indent=2))
    print("=============================\n")


async def run_research_agent() -> None:
    prompt = (
        "Use web search to find 2-3 current tips for saving money on weekly groceries in the US. "
        "Keep findings short and practical. Return JSON with findings and sources."
    )

    log_event(EVENT_LOG_PATH, "agent_run_started", agent_name=research_agent.name)
    result = await Runner.run(research_agent, prompt)
    log_event(EVENT_LOG_PATH, "agent_run_completed", agent_name=research_agent.name, status="ok")

    print("=== Research Agent Output ===")
    print(json.dumps(result.final_output.model_dump(), indent=2))
    print("=============================\n")


async def main() -> None:
    ensure_dirs(DATA_DIR, OUT_DIR, LOG_DIR, INV_DIR)

    # wire the event log into the tool layer
    set_event_log_path(EVENT_LOG_PATH)

    if not os.path.exists(INPUT_PATH):
        raise FileNotFoundError(
            f"Missing {INPUT_PATH}. Create shopping_notes.txt in {DATA_DIR} so input data is available to the agent."
        )

    log_event(EVENT_LOG_PATH, "run_started", lesson="lesson3", run_id=RUN_ID)

    # 1) Create inventory file if missing
    if not inventory_exists(INVENTORY_PATH):
        inv = build_default_inventory()
        save_inventory(INVENTORY_PATH, inv)
        log_event(EVENT_LOG_PATH, "inventory_created", inventory_path=INVENTORY_PATH, agent_count=len(inv.agents))
        print(f"Created starter inventory: {INVENTORY_PATH}\n")

    # 2) Load + validate inventory
    inventory = load_inventory(INVENTORY_PATH)
    log_event(EVENT_LOG_PATH, "inventory_loaded", inventory_path=INVENTORY_PATH, agent_count=len(inventory.agents))
    print_inventory(inventory)

    # 3) Run both agents once
    created_at = utc_now_iso()
    await run_shopping_agent(created_at)
    await run_research_agent()

    # 4) Summarize this run's events
    summary = summarize_run(EVENT_LOG_PATH)
    log_event(EVENT_LOG_PATH, "run_completed", lesson="lesson3", status="ok", event_counts=summary)

    print("=== Audit Summary (this run) ===")
    for k in sorted(summary.keys()):
        print(f"{k}: {summary[k]}")
    print("================================\n")
    print(f"Event log: {EVENT_LOG_PATH}")
    print(f"Run ID: {RUN_ID}")


if __name__ == "__main__":
    asyncio.run(main())