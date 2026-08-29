import os
import json
from typing import Optional, List

from agents import Agent, ModelSettings, WebSearchTool
from agents import function_tool
from pydantic import BaseModel

from agent_models import AgentSummaryOutput

# NOTE: We set this from main.py before running.
EVENT_LOG_PATH = ""

def set_event_log_path(path: str) -> None:
    global EVENT_LOG_PATH
    EVENT_LOG_PATH = path

def _log(event_type: str, **fields) -> None:
    # local import to avoid circular imports
    if not EVENT_LOG_PATH:
        return
    from observability import log_event
    log_event(EVENT_LOG_PATH, event_type, **fields)

# ---------------------------------------------------------------------------
# Tools (with observability)
# ---------------------------------------------------------------------------
@function_tool
def read_local_text(path: str) -> str:
    """Read a local text file from disk."""
    _log("tool_invoked", tool_name="read_local_text", tool_args={"path": path})
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        _log("tool_completed", tool_name="read_local_text", status="ok", output_chars=len(content))
        return content
    except Exception as e:
        _log("tool_completed", tool_name="read_local_text", status="error", error=str(e))
        raise

@function_tool
def write_local_json(path: str, payload: AgentSummaryOutput) -> str:
    """Write a structured JSON payload to disk and return the path."""
    _log("tool_invoked", tool_name="write_local_json", tool_args={"path": path})
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload.model_dump(), f, indent=2)
        _log("tool_completed", tool_name="write_local_json", status="ok", output_path=path)
        return path
    except Exception as e:
        _log("tool_completed", tool_name="write_local_json", status="error", error=str(e))
        raise

# ---------------------------------------------------------------------------
# Agent 1: Shopping assistant (local read/write)
# ---------------------------------------------------------------------------
shopping_agent = Agent(
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
        extra_body={"text": {"verbosity": "low"}},
    ),
    tools=[read_local_text, write_local_json],
)

# ---------------------------------------------------------------------------
# Agent 2: Research assistant (web search)
# ---------------------------------------------------------------------------
class ResearchOutput(BaseModel):
    topic: str
    findings: List[str]
    sources: List[str]

research_agent = Agent(
    name="Research Assistant Agent",
    model="gpt-5.2",
    instructions=(
        "You help validate shopping decisions with quick web research. "
        "Use Web Search when needed. "
        "Return practical, short findings. "
        "Always return valid JSON matching this structure exactly: "
        '{"topic":"string","findings":["string"],"sources":["string"]}'
    ),
    output_type=ResearchOutput,
    model_settings=ModelSettings(
        extra_body={"text": {"verbosity": "low"}},
    ),
    tools=[WebSearchTool()],
)
