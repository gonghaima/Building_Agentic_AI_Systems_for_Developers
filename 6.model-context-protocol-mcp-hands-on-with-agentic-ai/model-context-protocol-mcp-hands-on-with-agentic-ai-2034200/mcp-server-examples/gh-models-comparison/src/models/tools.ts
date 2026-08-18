import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getModelsData, callGitHubModelsAPI } from "../api/github-models.js";

export function registerTools(server: McpServer) {
  /**
   * MCP Tool to list available models
   */
  server.tool(
    "list_available_models",
    "Get a list of available GitHub Models",
    {
      include_metadata: z.boolean().default(false).describe("Whether to include additional model metadata"),
      filter_publisher: z.string().optional().describe("Filter models by publisher (e.g., 'OpenAI', 'Microsoft')"),
      sort_by: z.string().default("displayName").describe("Sort models by this field (options: 'displayName', 'publisher', 'popularity', 'context_window')")
    },
    async ({ include_metadata, filter_publisher, sort_by }) => {
      const models = await getModelsData();
      
      // Apply publisher filter if specified
      let filteredModels = models;
      if (filter_publisher) {
        filteredModels = models.filter(model => 
          model.publisher.toLowerCase() === filter_publisher.toLowerCase());
      }
      
      // Apply sorting
      const validSortFields = ["displayName", "publisher", "popularity", "context_window", "id"];
      const sortField = validSortFields.includes(sort_by) ? sort_by : "displayName";
      
      // Sort the models
      const sortedModels = [...filteredModels].sort((a, b) => {
        const valueA = a[sortField as keyof typeof a] || (typeof a[sortField as keyof typeof a] === 'string' ? "" : 0);
        const valueB = b[sortField as keyof typeof b] || (typeof b[sortField as keyof typeof b] === 'string' ? "" : 0);
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return valueA.localeCompare(valueB);
        }
        
        return (valueA as number) - (valueB as number);
      });
      
      if (include_metadata) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              models: sortedModels,
              count: sortedModels.length,
              publishers: [...new Set(models.map(model => model.publisher || "Unknown"))].sort(),
              applied_filters: {
                publisher: filter_publisher,
                sort_by: sortField
              }
            }, null, 2)
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              model_ids: sortedModels.map(model => model.id),
              count: sortedModels.length
            }, null, 2)
          }]
        };
      }
    }
  );

  /**
   * MCP Tool to get detailed information about a specific model
   */
  server.tool(
    "get_model_details",
    "Get detailed information about a specific model",
    {
      model_id: z.string().describe("The ID of the model to get details for")
    },
    async ({ model_id }) => {
      const models = await getModelsData();
      
      const model = models.find(m => m.id === model_id);
      
      if (model) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              model,
              found: true
            }, null, 2)
          }]
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Model with ID '${model_id}' not found`,
            found: false,
            available_models: models.map(m => m.id)
          }, null, 2)
        }]
      };
    }
  );

  /**
   * MCP Tool to compare responses from different GitHub models for the same prompt
   */
  server.tool(
    "compare_models",
    "Compare responses from different GitHub models for the same prompt",
    {
      prompt: z.string().describe("The user message to send to all models"),
      system_message: z.string().default("You are a helpful assistant.").describe("The system message to use"),
      models: z.array(z.string()).optional().describe("List of model names to compare (defaults to ['gpt-4o', 'Mistral-small', 'Phi-3-mini-128k-instruct'])"),
      temperature: z.number().describe("Temperature parameter for generation (0.0 to 2.0)").default(1.0),
      top_p: z.number().describe("Top-p parameter for generation (0.0 to 1.0)").default(1.0),
      max_tokens: z.number().default(1000).describe("Maximum tokens to generate")
    },
    async ({ prompt, system_message, models, temperature, top_p, max_tokens }, extra) => {
      const defaultModels = ["gpt-4o", "Mistral-small", "Phi-3-mini-128k-instruct"];
      const modelList = models || defaultModels;
      
      // Validate that the requested models exist
      const availableModels = await getModelsData();
      const availableModelIds = availableModels.map(model => model.id);
      
      // Filter out invalid models and warn about them
      const validModels = modelList.filter((modelName: string) => {
        const isValid = availableModelIds.includes(modelName);
        return isValid;
      });
      
      if (validModels.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "No valid models specified",
              available_models: availableModelIds
            }, null, 2)
          }]
        };
      }
      
      const results: Record<string, any> = {};
      const totalModels = validModels.length;
      
      for (let idx = 0; idx < validModels.length; idx++) {
        const modelName = validModels[idx];
        
        try {
          const response = await callGitHubModelsAPI(
            modelName,
            [
              { role: "system", content: system_message },
              { role: "user", content: prompt }
            ],
            temperature,
            top_p,
            max_tokens
          );
          
          results[modelName] = {
            content: response.choices[0].message.content,
            finish_reason: response.choices[0].finish_reason,
            usage: response.usage
          };
        } catch (error) {
          results[modelName] = { error: String(error) };
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            results,
            summary: {
              models_compared: validModels,
              prompt,
              system_message
            }
          }, null, 2)
        }]
      };
    }
  );
} 