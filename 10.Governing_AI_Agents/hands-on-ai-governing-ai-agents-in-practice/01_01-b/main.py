"""
Lesson 1: Examine an Agent

Steps: Run main.py

Goal: 
- Run the shopping agent and understand the tools and functionality

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

# ---------------------------------------------------------------------------
# Env + Client
# ---------------------------------------------------------------------------
_ = load_dotenv(find_dotenv())

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# ---------------------------------------------------------------------------
# Local demo files
# ---------------------------------------------------------------------------
BASE_DIR = "01_01-b"
DATA_DIR = f"{BASE_DIR}/data"
OUT_DIR = f"{BASE_DIR}/out"

#items that need to be purchased
INPUT_PATH = os.path.join(DATA_DIR, "shopping_notes.txt") 

#current state for what the agent will purchase
OUTPUT_PATH = os.path.join(OUT_DIR, "shopping_summary.json")

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
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

@function_tool
def write_local_json(path: str, payload: AgentSummaryOutput) -> str:
    """Write a structured JSON payload to disk and return the path."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload.model_dump(), f, indent=2)
    return path

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

def print_agent_inspection(agent: Agent) -> None:
    print("\n=== Agent Inspection ===")
    print(f"Name: {agent.name}")
    print("What to notice:")
    print("1) Tool access turns this into an agent (it can take actions).")
    print("2) Structured output creates a contract you can validate and audit.")
    print("3) This is the baseline we will govern in later videos.")
    print("========================\n")

async def main() -> None:
    print_agent_inspection(agent)
    created_at = datetime.now(timezone.utc).isoformat()

    # ---------------------------------------------------------------------------
    # TODO: 
    # Create a prompt for the agent that reads the input file from INPUT_PATH,  
    # writes the summary to JSON OUTPUT_PATH, and adds the created_at timestamp.
    # ---------------------------------------------------------------------------
    prompt = (
        #TODO: READ
        "Extract the budget (if present), list key needs as short items, and write a JSON summary to: "
        #TODO: WRITE
        #TODO: TIMESTAMP
        "Return the JSON."
    )

    try:
        result = await Runner.run(agent, prompt)
        output = parse_output(result.final_output)

        print("=== Agent Output ===")
        print(json.dumps(output.model_dump(), indent=2))
        print("====================\n")

        if os.path.exists(output.output_file):
            print(f"Saved summary file: {output.output_file}")
            with open(output.output_file, "r", encoding="utf-8") as f:
                print("\n=== Saved File Preview ===")
                print(f.read())
                print("==========================\n")
        else:
            print("Warning: output_file does not exist on disk.")

    except Exception as e:
        print("Error", e)


if __name__ == "__main__":
    asyncio.run(main())