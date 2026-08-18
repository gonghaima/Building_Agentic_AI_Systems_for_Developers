import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer) {
  /**
   * MCP Prompt to create a comparison prompt with selected models
   */
  server.prompt(
    "compare_models_prompt",
    "Create a comparison prompt with selected models",
    {
      prompt: z.string().describe("The prompt to compare"),
      models: z.string().optional().describe("Comma-separated list of models to compare")
    },
    ({ prompt, models }) => {
      if (models) {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Please compare how different AI models respond to this prompt: 
          
Prompt: ${prompt}

Please use these specific models: ${models}`
            }
          }]
        };
      } else {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Please compare how different AI models respond to this prompt: 
          
Prompt: ${prompt}

Please use the default models available.`
            }
          }]
        };
      }
    }
  );

  /**
   * MCP Prompt to evaluate differences between model responses
   */
  server.prompt(
    "evaluate_responses_prompt",
    "Evaluate differences between model responses",
    {
      prompt: z.string().describe("The original prompt that was compared"),
      models: z.string().describe("Comma-separated list of models that were compared")
    },
    ({ prompt, models }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `I've compared different AI models' responses to this prompt:

Prompt: ${prompt}

Models used: ${models}

Can you analyze the differences between their responses? Please highlight:
1. Key differences in content and approach
2. Strengths and weaknesses of each response
3. Which model performed best for this specific prompt and why`
          }
        }]
      };
    }
  );
} 