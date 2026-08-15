/**
 * Message types for chat interface
 * Based on SPEC.md requirements
 */

export interface FunctionCall {
  name: string
  arguments: string
  status: 'executing' | 'completed' | 'error'
  response?: any
}

/**
 * Represents a single step in the API trace timeline.
 * Steps are added incrementally during the function-calling loop
 * so the inspector panel can show real-time progress.
 */
export interface TraceStep {
  id: string
  label: string
  status: 'in-progress' | 'completed' | 'error'
  timestamp: number
  data?: unknown
}

export interface Message {
  role: 'user' | 'assistant' | 'function'
  content: string
  functionCall?: FunctionCall
  functionResponse?: any
  responseOutput?: unknown
  rawResponse?: any
}
