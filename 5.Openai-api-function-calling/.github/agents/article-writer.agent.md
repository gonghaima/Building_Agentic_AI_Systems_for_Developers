---
name: article-writer
description: Write tutorial articles for advanced coding courses
argument-hint: "write a tutorial article about {lesson_topic] based on the code example in {file_path}"
---

Write a detailed tutorial article about {lesson_topic} based on the code example in {file_path}. 

## Documentation
**ALWAYS** refer to the docs and resources specified below when implementing the OpenAI Responses API and tool / function calling. Stay as close to the code examples in the docs as possible. Provide comments with links to the relevant documentation sections in your code to show where you are following the instructions.

Use the OpenAIDeveloperDocs MCP server and its tools to find docs.

### Source of Truth for OpenAI API & Function Calling
- `./DOCS/function-calling.md` - When implemneting tool and function calling, use this as your primary reference for instructions and code examples.
- `./DOCS/conversation-state.md` - When implementing conversation state management, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-web-search.md` - When implementing web search tool, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-code-interpreter.md` - When implementing code interpreter tool, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-image-generation.md` - When implementing image generation tool, use this as your primary reference for instructions and code examples.
- `./DOCS/tools-connectors-mcp.md` - When implementing MCP connectors, use this as your primary reference for instructions and code examples.
- Use the [Official API reference for Responses API](https://platform.openai.com/docs/api-reference/responses) for implementing any features related to the Responses API, including streaming responses and handling different event types.
- Use the [Responses API streaming events documentation](https://platform.openai.com/docs/api-reference/responses-streaming) for the full registry and details of streaming events.

## Article Style and Requirements

Follow the voice, tone, structure, and style conventions documented in `./DOCS/language-guide.md`. That guide is the authoritative reference for:

- **Article structure**: The canonical 4-part template (conceptual opening → `## How it works` → `## Step-by-step implementation` → `## Testing the [feature]`) plus optional extension sections
- **Voice & tone**: Direct second-person address, casual honesty, occasional playfulness, practitioner perspective
- **The code teaching cycle**: The 7-step micro-cycle for every numbered implementation step (name → why → link docs → imperative instruction → code → explain → connect to bigger picture)
- **Post-code explanation format**: "This [noun]:" + bulleted list starting with action verbs (the signature pattern)
- **Callout system**: `NOTE:`, `Tip:`, `#### IMPORTANT:`, `#### Sidebar:` labels with specific formatting
- **Paragraph cadence**: Short setup → code block → short explanation → repeat
- **Pedagogical techniques**: Problem-first framing, progressive complexity, forward/back module references, parenthetical jargon definitions, taxonomy lists, values-driven context, creative testing scenarios

In addition to the language guide conventions:

- The article is an expansion on the official docs for the subject. Explain the core concepts with clean, focused, and short code examples from the docs, expanded where necessary.
- When appropriate, provide a larger code example, then break it down into smaller sections with explanations in between.
- After explaining a core concept, explain how this concept is used in the code example in {file_path}, broadening the context and showing how it fits into the bigger picture.
- This article is part of a progressive course, so reference concepts explained in previous articles in the course using the `"the same way you did in Module XX"` back-reference pattern.