# Text Assist MCP Server

This example MCP server provides basic tools for counting characters and words in a given text. The example shows how MCP servers are built using the [Python SDK](https://github.com/modelcontextprotocol/python-sdk) and demonstrates how MCP server tools are just standard Python functions in an MCP wrapper.

## Requirements

- [Claude.ai account](https://claude.ai) (MCP support is available for all account types)
- [Claude Desktop app](https://claude.ai/download), available for macOS and Windows
- [uv](https://docs.astral.sh/uv/):
   - macOS via Homebrew:
   ```bash
   brew install uv
   ```
   - Windows via WinGet:
   ```bash
   winget install --id=astral-sh.uv  -e
   ```
- A code editor like [Visual Studio Code](https://code.visualstudio.com/) 

## Installation

```bash
uv run
```

## Development

1. Start the virtual environment
   ```bash
   source .venv/bin/activate
   ```

   NOTE: To stop the virtual environment:
   ```bash
   deactivate
   ```

2. Run MCP server in dev mode with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

   ```bash
   mcp dev server.py
   ```

## Run MCP server in Claude Desktop

1. Open `claude_desktop_config.js` in an editor:
 
   File location:
   - MacOS / Linux `~/Library/Application/Support/Claude/claude_desktop_config.json`
   - Windows `AppData\Claude\claude_desktop_config.json`

2. Find the full path to `uv`:
  
   - MacOS / Linux:
   ```bash
   which uv
   ```
   - Windows:
   ```bash
   where uv
   ```

3. In `claude_desktop_config.js`

   ```json
   {
      "mcpServers": {
        "text-assist": {
          "command": "/absolute/path/to/uv",
          "args": [
            "run",
            "--with",
            "mcp[cli]",
            "mcp",
            "run",
            "/absolute/path/to/text-assist/server.py"
          ]
        }
      }
   }
   ```

4. Reboot Claude Desktop and use a prompt that will trigger your MCP.

## Usage

In Claude Desktop, you can:

- Count the total number of characters in a text
- Count characters excluding spaces
- Count words in a text
- Count occurrences of specific letters
- Get a full text analysis including:
  - Total character count
  - Character count without spaces
  - Word count
  - Space count
  - Character frequency distribution
