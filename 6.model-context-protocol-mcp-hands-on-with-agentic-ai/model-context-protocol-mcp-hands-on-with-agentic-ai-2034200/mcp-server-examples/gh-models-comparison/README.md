# GitHub Models Comparison MCP Server

This is an advanced tutorial on building MCP servers, demonstrating a modular approach to creating a server that compares different GitHub Models.

## Project Structure

```
src/
├── api/
│   └── github-models.ts    # GitHub Models API integration
├── models/
│   ├── resources.ts        # MCP resources for model operations
│   └── tools.ts           # MCP tools for model operations
├── prompts/
│   └── model-comparison.ts # MCP prompts for model comparison
├── types/
│   └── index.ts           # TypeScript type definitions
└── index.ts               # Main server entry point
```

## Features

- List available GitHub Models with metadata
- Compare responses from different models
- Filter and sort models by various criteria
- Cache model data to reduce API calls
- Comprehensive error handling and fallbacks

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env` file with:
   ```
   GITHUB_TOKEN=your_github_personal_access_token
   ```

3. Build the project
   ```bash
   npm run build
   ```

4. Run the MCP server in development mode:
   ```bash
   npx @modelcontextprotocol/inspector dist/index.js
   ```

5. Add the MCP server to Claude Desktop:
   In `claude_desktop_config.json`
   ```json
   {
      "mcpServers": {
         "GitHub Models Comparison": {
            "command": "node",
            "args": [
            "/absolute/path/to/gh-models-comparison/dist/index.js"
            ],
            "env": {
            "GITHUB_TOKEN": "your_github_personal_access_token"
            }
         }
      }
   }

## Trying out the MCP Server in Claude Desktop
Try variants on these prompts to see the MCP server in action:

- "list all available phi-3 models"
- "compare Phi-3-mini-4k-instruct and mistral-small on this prompt: how many ns in bananasss??"
- "Do a comparison between the Phi-4, gpt-4o-mini, and mistral-small models"

## Module Overview

### API Module (`src/api/`)
- Handles all interactions with the GitHub Models API
- Implements caching for model data
- Provides fallback data when API is unavailable

### Models Module (`src/models/`)
- `resources.ts`: MCP resources for model operations
  - List available models
  - Example comparisons
  - Usage guide
- `tools.ts`: MCP tools for model operations
  - List and filter models
  - Get model details
  - Compare model responses

### Prompts Module (`src/prompts/`)
- Defines MCP prompts for model comparison
- Provides templates for comparison and evaluation

### Types Module (`src/types/`)
- TypeScript interfaces for API responses
- Type definitions for model data
- Cache-related types

