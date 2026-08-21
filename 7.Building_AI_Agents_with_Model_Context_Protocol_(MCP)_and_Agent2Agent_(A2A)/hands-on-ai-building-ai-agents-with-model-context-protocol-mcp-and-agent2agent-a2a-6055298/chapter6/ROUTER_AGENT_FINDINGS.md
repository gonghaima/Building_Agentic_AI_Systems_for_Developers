# Router Agent Findings — `a2a_client_router_agent.py`

## Overview

`a2a_client_router_agent.py` implements a LangGraph-based router that classifies a user's query and dispatches it to one of two remote agents over the A2A (Agent2Agent) protocol.

## Routing Flow

### 1. Classification via LLM (`Router` node → `call_llm`)

The graph starts at the `Router` node (lines 96-116), which calls the Azure OpenAI model with a system prompt (lines 197-204) instructing it to classify the query into exactly one of three labels:

- `POLICY` — HR policy questions (leave, remote work, etc.)
- `TIMEOFF` — time-off requests or balance checks
- `UNSUPPORTED` — anything else

The LLM's one-word answer is appended to state as an `AIMessage`.

### 2. Conditional branching (`find_route`)

`find_route` (lines 178-187) reads the last message's content — the LLM's classification word — and returns it as the routing key. `add_conditional_edges` (lines 102-108) maps that key to a node:

```python
{
    "POLICY": "Policy_Agent",
    "TIMEOFF": "Timeoff_Agent",
    "UNSUPPORTED": "Unsupported_functions",
}
```

### 3. Dispatch to a remote agent over A2A

- `POLICY` → `policy_agent_node` calls `execute_a2a_agent("http://localhost:9001", ...)` (line 142)
- `TIMEOFF` → `timeoff_agent_node` calls `execute_a2a_agent("http://localhost:9002", ...)` (line 157)
- `UNSUPPORTED` → `unsupported_node` returns a canned refusal message, no remote call (lines 164-176)

`execute_a2a_agent` (lines 41-76) performs the actual A2A protocol work:
1. Fetches the remote agent's "agent card" from the given URL
2. Builds an `A2AClient` from that card
3. Wraps `{user, prompt}` as a JSON text part inside an A2A `SendMessageRequest`
4. Sends the request and extracts the text back out of the response

### 4. Terminal edges

Each agent node connects directly to `END` (lines 111-113) — routing is one-shot per invocation, with no loop back to the `Router` node within a single graph run.

## Summary

```
user query
   │
   ▼
LLM classifies intent (Router node)
   │
   ▼
conditional edge picks a node (find_route)
   │
   ├─ POLICY    → A2A call to localhost:9001 (HR Policy Agent)
   ├─ TIMEOFF   → A2A call to localhost:9002 (Timeoff Agent)
   └─ UNSUPPORTED → canned refusal, no remote call
   │
   ▼
response flows back into graph state
```
