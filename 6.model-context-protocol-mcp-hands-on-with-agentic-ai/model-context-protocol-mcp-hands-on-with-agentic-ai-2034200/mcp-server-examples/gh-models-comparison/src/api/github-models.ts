import axios from "axios";
import { ChatMessage, ChatCompletion, ModelData } from "../types/index.js";

// API Constants
const ENDPOINT = "https://models.inference.ai.azure.com";
const TOKEN = process.env.GITHUB_TOKEN || "";
const CACHE_TTL = 600; // 10 minutes in seconds

// Cache state
let modelsCache: ModelData[] | null = null;
let modelsCacheTimestamp = 0;

/**
 * Send a request to the GitHub Models API
 */
export async function callGitHubModelsAPI(
  model: string, 
  messages: ChatMessage[], 
  temperature: number,
  topP: number, 
  maxTokens: number
): Promise<ChatCompletion> {
  if (!TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  try {
    const response = await axios.post(
      `${ENDPOINT}/v1/chat/completions`,
      {
        model,
        messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': TOKEN
        }
      }
    );
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`GitHub Models API error: ${error.response?.status} ${error.response?.data || error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch list of available models from GitHub Models
 * Lookup method and API endpoint lifted from the GitHub Models Extension
 * @link https://github.com/copilot-extensions/github-models-extension 
 */
export async function fetchAvailableModels(): Promise<ModelData[]> {
  try {
    const url = "https://api.catalog.azureml.ms/asset-gallery/v1.0/models";
    const headers = { "Content-Type": "application/json" };
    const body = {
      filters: [
        { field: "freePlayground", values: ["true"], operator: "eq" },
        { field: "labels", values: ["latest"], operator: "eq" }
      ],
      order: [{ field: "displayName", direction: "Asc" }]
    };

    const response = await axios.post(url, body, { headers });
    if (!response.data) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const apiResponse = response.data;
    const modelsData: ModelData[] = [];
    
    for (const model of apiResponse.summaries || []) {
      const assetId = model.assetId || "";
      const modelId = model.name || "";
      
      const modelInfo: ModelData = {
        id: modelId,
        displayName: model.displayName || modelId,
        publisher: model.publisher || "Unknown",
        summary: model.summary || "",
        version: model.version || "",
        context_window: model.modelLimits?.textLimits?.inputContextWindow || 0,
        supported_languages: model.modelLimits?.supportedLanguages || [],
        popularity: model.popularity || 0,
        keywords: model.keywords || [],
        assetId: assetId
      };
      modelsData.push(modelInfo);
    }
    
    return modelsData;
  } catch (error) {
    // Silently fall back to default models without logging
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
 * Get model data with caching
 */
export async function getModelsData(): Promise<ModelData[]> {
  const currentTime = Date.now() / 1000;
  
  if (modelsCache !== null && (currentTime - modelsCacheTimestamp) < CACHE_TTL) {
    return modelsCache;
  }
  
  modelsCache = await fetchAvailableModels();
  modelsCacheTimestamp = currentTime;
  return modelsCache;
} 