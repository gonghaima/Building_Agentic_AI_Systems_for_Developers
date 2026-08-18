# GitHub Models Helper MCP Server

This is an MCP server that helps interact with and compare different GitHub Models.

## Features

- List available GitHub Models with metadata
- Compare responses from different models
- Filter and sort models by various criteria
- Comprehensive error handling and fallbacks

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Copy `.env.template` to `.env` and add your GitHub token:
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
         "GitHub Models Helper": {
            "command": "node",
            "args": [
            "/absolute/path/to/gh-models-helper/dist/index.js"
            ],
            "env": {
            "GITHUB_TOKEN": "your_github_personal_access_token"
            }
         }
      }
   }
   ```

## Trying out the MCP Server in Claude Desktop
Try variants on these prompts to see the MCP server in action:

- "list all available phi-3 models"
- "compare Phi-3-mini-4k-instruct and mistral-small on this prompt: how many ns in bananasss??"
- "Do a comparison between the Phi-4, gpt-4o-mini, and mistral-small models"

