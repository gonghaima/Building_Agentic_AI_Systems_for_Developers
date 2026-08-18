import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

// API Constants
const GITHUB_MODELS_ENDPOINT = "https://models.inference.ai.azure.com/v1/chat/completions";
const API_KEY = process.env.GITHUB_TOKEN;

// Cache settings
const CACHE_TTL = 600; // 10 minutes in seconds
let modelsCache: ModelData[] | null = null;
let modelsCacheTimestamp = 0;

/**
 * Interface for model data
 */
interface ModelData {
  id: string;
  displayName: string;
  publisher: string;
  summary: string;
  context_window: number;
  assetId?: string;
  version?: string;
  supported_languages?: string[];
  popularity?: number;
  keywords?: string[];
}

/**
 * Interface for chat message
 */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Interface for chat completion response
 */
interface ChatCompletion {
  choices: {
    message: {
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Interface for resource URI
 */
interface ResourceUri {
  href: string;
}

/**
 * Interface for tool parameters
 */
interface ListModelsParams {
  include_metadata: boolean;
}

interface CompareModelsParams {
  prompt: string;
  models: string[];
}

interface CompareModelsPromptParams {
  prompt: string;
  models?: string;
}

/**
 * Get a list of available models from GitHub Models
 * Includes caching to prevent excessive API calls
 * Lookup method and API endpoint lifted from the GitHub Models Extension
 * @link https://github.com/copilot-extensions/github-models-extension 
 */
async function getModelsData(): Promise<ModelData[]> {
  const currentTime = Date.now() / 1000;
  
  // Return cached data if still valid
  if (modelsCache !== null && (currentTime - modelsCacheTimestamp) < CACHE_TTL) {
    return modelsCache;
  }

  try {
    const response = await axios.post("https://api.catalog.azureml.ms/asset-gallery/v1.0/models", {
      filters: [
        { field: "freePlayground", values: ["true"], operator: "eq" },
        { field: "labels", values: ["latest"], operator: "eq" }
      ],
      order: [{ field: "displayName", direction: "Asc" }]
    }, {
      headers: { "Content-Type": "application/json" }
    });

    if (!response.data?.summaries) {
      throw new Error("Invalid response format from Models API");
    }

    const modelsData: ModelData[] = response.data.summaries.map((model: any) => ({
      id: model.name || "",
      displayName: model.displayName || model.name || "",
      publisher: model.publisher || "Unknown",
      summary: model.summary || "",
      version: model.version || "",
      context_window: model.modelLimits?.textLimits?.inputContextWindow || 0,
      supported_languages: model.modelLimits?.supportedLanguages || [],
      popularity: model.popularity || 0,
      keywords: model.keywords || [],
      assetId: model.assetId || ""
    }));

    // Update cache
    modelsCache = modelsData;
    modelsCacheTimestamp = currentTime;
    
    return modelsData;
  } catch (error) {
    console.error("Error fetching models:", error);
    // Return fallback data in case of API failure
    return getFallbackModels();
  }
}

/**
 * Get fallback models when API fails
 */
function getFallbackModels(): ModelData[] {
    return [
      { id: "gpt-4o", displayName: "GPT-4o", publisher: "OpenAI", summary: "OpenAI's most advanced multimodal model", context_window: 128000 },
      { id: "gpt-4o-mini", displayName: "GPT-4o-mini", publisher: "OpenAI", summary: "Smaller, efficient version of GPT-4o", context_window: 128000 },
      { id: "Phi-3.5-MoE-instruct", displayName: "Phi-3.5-MOE Instruct", publisher: "Microsoft", summary: "A mixture of experts model from Microsoft", context_window: 131072 },
      { id: "Phi-3-mini-128k-instruct", displayName: "Phi-3-Mini Instruct 128k", publisher: "Microsoft", summary: "Small model with large context window", context_window: 131072 },
      { id: "Llama-3.3-70B-Instruct", displayName: "Meta Llama 3.3 70B Instruct", publisher: "Meta", summary: "Advanced reasoning and instruction following", context_window: 128000 },
      { id: "Meta-Llama-3-8B-Instruct", displayName: "Meta Llama 3 8B Instruct", publisher: "Meta", summary: "Balanced performance and efficiency", context_window: 8192 },
      { id: "Mistral-large", displayName: "Mistral Large", publisher: "Mistral AI", summary: "Mistral's flagship model for complex reasoning", context_window: 32768 },
      { id: "Mistral-small", displayName: "Mistral Small", publisher: "Mistral AI", summary: "Efficient model for low-latency use cases", context_window: 32768 }
    ];
  }

/**
 * Compare responses from different models
 * Makes actual API calls to get model responses
 */
async function compareModels(prompt: string, models: string[]): Promise<Record<string, string>> {
  if (!API_KEY) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  const responses: Record<string, string> = {};
  const messages: ChatMessage[] = [
    { role: "user", content: prompt }
  ];

  for (const model of models) {
    try {
      const response = await axios.post(
        GITHUB_MODELS_ENDPOINT,
        {
          model,
          messages,
          temperature: 0.7,
          top_p: 1,
          max_tokens: 1000
        },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": API_KEY
          }
        }
      );

      const completion = response.data as ChatCompletion;
      responses[model] = completion.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        responses[model] = `Error: ${error.response?.status} ${error.response?.data?.error?.message || error.message}`;
      } else {
        responses[model] = `Error: ${(error as Error).message}`;
      }
    }
  }

  return responses;
}

// Create an MCP server
const server = new McpServer({
  name: "Model Helper",
  version: "1.0.0"
});

// Register the models://available resource
server.resource(
  "models://available",
  new ResourceTemplate("models://available", { list: undefined }),
  { description: "List available language models" },
  async (uri: ResourceUri) => {
    const models = await getModelsData();
    const formattedText = [
      "# Available Models",
      "",
      ...models.map(model => [
        `## ${model.displayName} (\`${model.id}\`)`,
        `- Publisher: ${model.publisher}`,
        `- Context Window: ${model.context_window.toLocaleString()} tokens`,
        `- Summary: ${model.summary}`,
        ""
      ]).flat()
    ].join("\n");

    return {
      contents: [{
        uri: uri.href,
        text: formattedText
      }]
    };
  }
);

// Register the list_available_models tool
server.tool(
  "list_available_models",
  "Get a list of available language models",
  {
    include_metadata: z.boolean()
      .default(false)
      .describe("Whether to include additional model metadata")
  },
  async ({ include_metadata }: ListModelsParams) => {
    const models = await getModelsData();
    
    if (include_metadata) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            models,
            count: models.length,
            publishers: [...new Set(models.map(model => model.publisher))].sort()
          }, null, 2)
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            model_ids: models.map(model => model.id),
            count: models.length
          }, null, 2)
        }]
      };
    }
  }
);

// Register the compare_models tool
server.tool(
  "compare_models",
  "Compare responses from different models for the same prompt",
  {
    prompt: z.string()
      .describe("The prompt to send to all models"),
    models: z.array(z.string())
      .default(["gpt-4", "claude-3"])
      .describe("List of model IDs to compare")
  },
  async ({ prompt, models }: CompareModelsParams) => {
    const availableModels = await getModelsData();
    const validModels = models.filter((id: string) => 
      availableModels.some(model => model.id === id)
    );

    if (validModels.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "No valid models specified",
            available_models: availableModels.map(m => m.id)
          }, null, 2)
        }]
      };
    }

    const responses = await compareModels(prompt, validModels);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          results: responses,
          summary: {
            models_compared: validModels,
            prompt
          }
        }, null, 2)
      }]
    };
  }
);

// Register the compare_models_prompt
server.prompt(
  "compare_models_prompt",
  "Create a comparison prompt with selected models",
  {
    prompt: z.string()
      .describe("The prompt to compare"),
    models: z.string()
      .optional()
      .describe("Comma-separated list of models to compare")
  },
  ({ prompt, models }: CompareModelsPromptParams) => {
    const message = models
      ? `Please compare how different AI models respond to this prompt:\n\nPrompt: ${prompt}\n\nPlease use these specific models: ${models}`
      : `Please compare how different AI models respond to this prompt:\n\nPrompt: ${prompt}\n\nPlease use the default models available.`;

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: message
        }
      }]
    };
  }
);

/**
 * Main function to start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});
