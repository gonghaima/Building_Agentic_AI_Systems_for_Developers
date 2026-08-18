// Azure AI SDK types
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletion {
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

// Model data types
export interface ModelData {
  id: string;
  displayName: string;
  publisher: string;
  summary: string;
  version?: string;
  context_window: number;
  supported_languages?: string[];
  popularity?: number;
  keywords?: string[];
  assetId?: string;
}

// Cache types
export interface ModelsCache {
  data: ModelData[] | null;
  timestamp: number;
} 