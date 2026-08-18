import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import { registerResources } from "./models/resources.js";
import { registerTools } from "./models/tools.js";
import { registerPrompts } from "./prompts/model-comparison.js";

// Load environment variables
dotenv.config();

// Create an MCP server
const server = new McpServer({
  name: "GitHub Models Comparison",
  version: "1.0.0"
});

// Register all components
registerResources(server);
registerTools(server);
registerPrompts(server);

/**
 * Main function to start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  process.exit(1);
});