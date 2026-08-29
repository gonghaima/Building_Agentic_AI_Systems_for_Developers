"""
Lesson 2: Observe Agent Behavior

Steps: Run main.py

Goal:
- Run the shopping agent with structured logging so you can audit what happened
- Capture run start/end, tool invocations, tool outputs, and validated final output

Prereqs:
  pip install -r requirements.txt
  export OPENAI_API_KEY="..."   (or set in .env)
"""

import os
import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Optional, List

from openai import OpenAI
from dotenv import load_dotenv, find_dotenv
from agents import Agent, Runner, ModelSettings
from agents import function_tool
from pydantic import BaseModel, ValidationError

from observability import (
    RUN_ID,
    log_event,
    ensure_dirs,
    summarize_run,
)

# ---------------------------------------------------------------------------
# Env + Client
# ---------------------------------------------------------------------------
_ = load_dotenv(find_dotenv())

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# ---------------------------------------------------------------------------
# Local demo files
# ---------------------------------------------------------------------------
BASE_DIR = "01_02-e"
DATA_DIR = f"{BASE_DIR}/data"
OUT_DIR = f"{BASE_DIR}/out"
LOG_DIR = f"{BASE_DIR}/logs"

# items that need to be purchased
INPUT_PATH = os.path.join(DATA_DIR, "shopping_notes.txt")

#current state for what the agent will purchase
OUTPUT_PATH = os.path.join(OUT_DIR, "shopping_summary.json")

# structured event log for auditing
EVENT_LOG_PATH = os.path.join(LOG_DIR, "agent_events.jsonl")


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------
class AgentSummaryOutput(BaseModel):
    input_file: str
    budget: Optional[str]
    key_needs: List[str]
    summary: str
    output_file: str
    created_at: str


# ---------------------------------------------------------------------------
# Tools (wrapped as FunctionTool)
# ---------------------------------------------------------------------------
@function_tool
def read_local_text(path: str) -> str:
    """Read a local text file from disk."""
    log_event(
        "tool_invoked",
        tool_name="read_local_text",
        tool_args={"path": path},
    )

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        log_event(
            "tool_completed",
            tool_name="read_local_text",
            status="ok",
            output_chars=len(content),
        )
        return content

    except Exception as e:
        log_event(
            "tool_completed",
            tool_name="read_local_text",
            status="error",
            error=str(e),
        )
        raise


@function_tool
def write_local_json(path: str, payload: AgentSummaryOutput) -> str:
    """Write a structured JSON payload to disk and return the path."""
    log_event(
        "tool_invoked",
        tool_name="write_local_json",
        tool_args={"path": path},
    )

    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload.model_dump(), f, indent=2)

        log_event(
            "tool_completed",
            tool_name="write_local_json",
            status="ok",
            output_path=path,
        )
        return path

    except Exception as e:
        log_event(
            "tool_completed",
            tool_name="write_local_json",
            status="error",
            error=str(e),
        )
        raise


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------
agent = Agent(
    name="Shopping Assistant Agent",
    model="gpt-5.2",
    instructions=(
        "You summarize shopping requirements from a local notes file. "
        "Use tools when helpful. "
        "You may read the input file and write a JSON summary to disk. "
        "Always return valid JSON matching this structure exactly: "
        '{"input_file":"string","budget":"string or null","key_needs":["string"],'
        '"summary":"string","output_file":"string","created_at":"string"}'
    ),
    output_type=AgentSummaryOutput,
    model_settings=ModelSettings(
        reasoning={"effort": "medium"},
        extra_body={"text": {"verbosity": "low"}},
    ),
    tools=[read_local_text, write_local_json],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def parse_output(raw: Any) -> AgentSummaryOutput:
    if isinstance(raw, AgentSummaryOutput):
        return raw
    if isinstance(raw, str):
        try:
            return AgentSummaryOutput(**json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as e:
            raise ValueError(f"Agent returned invalid JSON: {e}") from e
    if isinstance(raw, dict):
        return AgentSummaryOutput(**raw)
    raise TypeError(f"Unsupported output type: {type(raw)}")


def print_audit_summary() -> None:
    """
    Minimal audit view: count event types for THIS run_id.
    """
    if not os.path.exists(EVENT_LOG_PATH):
        print("No event log found.")
        return

    counts: dict[str, int] = {}
    with open(EVENT_LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                continue

            if evt.get("run_id") != RUN_ID:
                continue

            t = evt.get("event_type", "unknown")
            counts[t] = counts.get(t, 0) + 1

    print("\n=== Audit Summary (this run) ===")
    for k in sorted(counts.keys()):
        print(f"{k}: {counts[k]}")
    print("================================\n")



async def main() -> None:
    ensure_dirs(OUT_DIR, LOG_DIR)
    created_at = datetime.now(timezone.utc).isoformat()

    log_event(
        EVENT_LOG_PATH,
        "run_started",
        agent_name=agent.name,
        input_file=INPUT_PATH,
        output_file=OUTPUT_PATH,
    )

    prompt = (
        f"Read the shopping notes at: {INPUT_PATH}. "
        "Extract the budget (if present), list key needs as short items, and write a JSON summary to: "
        f"{OUTPUT_PATH}. "
        f'Set created_at to "{created_at}". '
        "Return the JSON."
    )

    try:
        result = await Runner.run(agent, prompt)
        output = parse_output(result.final_output)

        log_event(
            EVENT_LOG_PATH,
            "output_validated",
            schema="AgentSummaryOutput",
            output_file=output.output_file,
            key_needs_count=len(output.key_needs),
        )

        log_event(
            EVENT_LOG_PATH,
            "run_completed",
            agent_name=agent.name,
            status="ok",
        )

    except Exception as e:
        log_event(
            EVENT_LOG_PATH,
            "run_completed",
            agent_name=agent.name,
            status="error",
            error=str(e),
        )
        raise

    summary = summarize_run(EVENT_LOG_PATH)

    print("\n=== Audit Summary ===")
    for k, v in summary.items():
        print(f"{k}: {v}")
    print("=====================\n")


if __name__ == "__main__":
    asyncio.run(main())


