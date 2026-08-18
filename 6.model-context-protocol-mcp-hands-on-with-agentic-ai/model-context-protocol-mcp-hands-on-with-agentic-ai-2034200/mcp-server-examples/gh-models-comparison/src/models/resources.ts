import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getModelsData } from "../api/github-models.js";

export function registerResources(server: McpServer) {
  /**
   * MCP Resource exposing list of available models from GitHub Models
   */
  server.resource(
    "models://available",
    new ResourceTemplate("models://available", { list: undefined }),
    { description: "List available models from GitHub Models" },
    async (uri, params) => {
      const models = await getModelsData();
      
      // Format the models data into a readable string
      const formattedModels = ["# Available Models", ""];
      
      // Group models by publisher
      const publishers: Record<string, any[]> = {};
      
      for (const model of models) {
        const modelId = model.id || "unknown";
        const displayName = model.displayName || modelId;
        const publisher = model.publisher || "Unknown";
        const contextWindow = model.context_window || 0;
        const summary = model.summary || "";
        
        if (!publishers[publisher]) {
          publishers[publisher] = [];
        }
        
        publishers[publisher].push({
          id: modelId,
          display_name: displayName,
          context_window: contextWindow,
          summary: summary
        });
      }
      
      // Sort publishers alphabetically
      for (const publisher of Object.keys(publishers).sort()) {
        formattedModels.push(`## ${publisher}`);
        formattedModels.push("");
        
        // Sort models by display name within each publisher
        for (const model of publishers[publisher].sort((a, b) => 
            a.display_name.localeCompare(b.display_name))) {
          const contextStr = model.context_window ? 
            ` - ${model.context_window.toLocaleString()} tokens` : "";
          const summaryStr = model.summary ? ` - ${model.summary}` : "";
          formattedModels.push(`- **${model.display_name}** (\`${model.id}\`)${contextStr}${summaryStr}`);
        }
        
        formattedModels.push("");
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: formattedModels.join("\n")
        }]
      };
    }
  );

  /**
   * MCP Resource exposing example model comparison
   */
  server.resource(
    "examples://comparison",
    new ResourceTemplate("examples://comparison", { list: undefined }),
    { description: "Example model comparison for the MCP client" },
    async (uri, params) => {
      const example = {
        prompt: "Explain the concept of quantum computing in simple terms.",
        models: ["gpt-4o", "claude-3-opus-20240229", "Phi-4"],
        temperature: 0.7
      };
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(example, null, 2)
        }]
      };
    }
  );

  /**
   * MCP Resource exposing usage guide for the models comparison
   */
  server.resource(
    "models://usage",
    new ResourceTemplate("models://usage", { list: undefined }),
    { description: "Usage guide for the models comparison for the MCP client" },
    async (uri, params) => {
      const usageGuide = `# GitHub Models Comparison Usage Guide

## Basic Usage

1. First, explore available models:
   - Check the \`models://available\` resource for a list of all models
   - Use the \`list_available_models\` tool to get models programmatically

2. Compare models with similar prompts:
   \`\`\`json
   {
     "prompt": "Your question or task here",
     "models": ["gpt-4o", "Mistral-Large-2411", "Phi-4"],
     "temperature": 0.7
   }
   \`\`\`

3. For batch processing:
   \`\`\`json
   {
     "prompts": [
       "What is machine learning?",
       "Explain the difference between supervised and unsupervised learning",
       "How does reinforcement learning work?"
     ],
     "models": ["gpt-4o", "Phi-4"]
   }
   \`\`\`

## Advanced Options

- **Filter by publisher**: \`list_available_models(filter_publisher="Microsoft")\`
- **Include metadata**: \`list_available_models(include_metadata=true)\`
- **Sort models**: \`list_available_models(sort_by="context_window")\`
- **Get model details**: \`get_model_details(model_id="Phi-4")\`
- **Save results**: Use \`save_comparison_results\` to persist comparisons to a file

## Environment Setup

Ensure your \`.env\` file contains:
\`\`\`
GITHUB_TOKEN=your_github_personal_access_token
\`\`\``;

      return {
        contents: [{
          uri: uri.href,
          text: usageGuide
        }]
      };
    }
  );
} 