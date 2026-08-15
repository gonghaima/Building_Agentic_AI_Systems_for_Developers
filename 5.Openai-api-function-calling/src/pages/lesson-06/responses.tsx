/**
 * Lesson 06: Remote MCP Server
 *
 * Focus: Connecting to a remote MCP server and streaming responses
 * Docs: https://platform.openai.com/docs/guides/tools-connectors-mcp
 * Streaming: https://platform.openai.com/docs/api-reference/responses-streaming
 * API Reference: https://platform.openai.com/docs/api-reference/responses/create
 *
 * This lesson demonstrates:
 * - Using the `mcp` built-in tool type to connect to a remote MCP server
 *   See: https://platform.openai.com/docs/guides/tools-connectors-mcp#quickstart
 * - Setting `require_approval: "never"` to auto-approve all tool calls
 * - Streaming MCP lifecycle events:
 *     response.mcp_list_tools.in_progress → .completed  (tool discovery)
 *     response.mcp_call.in_progress → .completed        (tool execution)
 *   See: https://platform.openai.com/docs/api-reference/responses-streaming
 * - Streaming text with `response.output_text.delta`
 * - Using `response.completed` to capture the final response object
 *
 * Builds on Lesson 05 (streaming) by swapping the web_search tool
 * for a remote MCP server that provides OpenAI documentation search.
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { ApiKeyConfig } from '@/components/ApiKeyConfig'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

// Streaming event types we handle (subset of all ResponseStreamEvent types).
// Full list: https://platform.openai.com/docs/api-reference/responses-streaming
// - response.mcp_list_tools.{in_progress, completed}  — tool discovery
// - response.mcp_call.{in_progress, completed, failed} — tool execution
// - response.output_text.delta                         — text streaming
// - response.completed                                 — final response

/**
 * Define the MCP tool pointing to a remote flights server.
 * See: https://platform.openai.com/docs/guides/tools-connectors-mcp#quickstart
 *
 * The `mcp` tool type connects to a remote MCP server via its URL.
 * The API first lists available tools (creates an `mcp_list_tools` output),
 * then calls tools as needed (creates `mcp_call` outputs).
 * Setting `require_approval: "never"` auto-approves all tool calls.
 */
const tools: OpenAI.Responses.Tool[] = [
  {
    type: 'mcp',
    server_label: 'openai_docs',
    server_description: 'OpenAI developer documentation MCP server for searching and reading docs.',
    server_url: 'https://developers.openai.com/mcp',
    // Auto-approve all tool calls for simplicity.
    // See: https://platform.openai.com/docs/guides/tools-connectors-mcp#approvals
    require_approval: 'never',
  },
]

export default function Lesson06Responses() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { traceSteps, pushTrace, clearTrace } = useTrace()
  const [apiKey, setApiKey] = useState<string | null>(
    import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key') || null
  )

  async function handleSend(input: string) {
    if (!apiKey) return

    setIsLoading(true)

    try {
      // Reset trace for a fresh request
      clearTrace()

      // Add user message to chat
      const userMessage: Message = { role: 'user', content: input }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)

      // Initialize OpenAI client with API key
      const client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // Note: In production, use a backend proxy
      })

      // Mark the streaming request in the trace panel
      pushTrace({ id: 'stream-request', label: 'Streaming response…', status: 'in-progress', timestamp: Date.now(), data: { model: 'gpt-5', messageCount: newMessages.length } })

      /**
       * Create a streaming request by setting `stream: true`.
       * This returns an async iterable of server-sent events instead of
       * a single completed response.
       * See: https://platform.openai.com/docs/guides/function-calling#streaming
       * Events reference: https://platform.openai.com/docs/api-reference/responses-streaming
       */
      const stream = await client.responses.create({
        model: 'gpt-5',
        tools,
        instructions:
          'You have access to the OpenAI developer docs MCP server. ' +
          'Use the available tools when the user asks about OpenAI APIs, SDKs, or documentation. For other topics, respond normally.',
        input: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        stream: true, // Enable streaming — key change from Lesson 04
      })

      // Add an empty assistant message that we'll update incrementally
      // as `response.output_text.delta` events arrive.
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      /**
       * Process streaming events with `for await`.
       * See: https://platform.openai.com/docs/guides/function-calling#streaming
       *
       * We handle a focused subset of events:
       * - MCP tool discovery: mcp_list_tools.in_progress → .completed
       * - MCP tool execution: mcp_call.in_progress → .completed / .failed
       * - Text deltas: response.output_text.delta (append to message)
       * - Completion: response.completed (capture final response)
       */
      for await (const event of stream) {
        switch (event.type) {
          /**
           * MCP tool discovery events.
           * See: https://platform.openai.com/docs/api-reference/responses-streaming
           * These fire when the API lists available tools from the MCP server.
           * The resulting `mcp_list_tools` output item contains the tool definitions.
           */
          case 'response.mcp_list_tools.in_progress':
            pushTrace({ id: `mcp-list-${event.item_id}`, label: 'Listing MCP tools…', status: 'in-progress', timestamp: Date.now() })
            break

          case 'response.mcp_list_tools.completed':
            pushTrace({ id: `mcp-list-${event.item_id}`, label: 'MCP tools listed', status: 'completed', timestamp: Date.now() })
            break

          /**
           * MCP tool call lifecycle events.
           * See: https://platform.openai.com/docs/api-reference/responses-streaming
           * These fire when the model calls a tool on the remote MCP server.
           * Each event has an `item_id` identifying the specific tool call.
           */
          case 'response.mcp_call.in_progress':
            pushTrace({ id: `mcp-call-${event.item_id}`, label: 'MCP tool call in progress…', status: 'in-progress', timestamp: Date.now() })
            break

          case 'response.mcp_call.completed':
            pushTrace({ id: `mcp-call-${event.item_id}`, label: 'MCP tool call completed', status: 'completed', timestamp: Date.now() })
            break

          case 'response.mcp_call.failed':
            pushTrace({ id: `mcp-call-${event.item_id}`, label: 'MCP tool call failed', status: 'error', timestamp: Date.now() })
            break

          /**
           * Text streaming: append each delta to the assistant message.
           * See: https://platform.openai.com/docs/api-reference/responses-streaming/response/output_text/delta
           * Each event contains a `delta` string (a few characters/tokens).
           */
          case 'response.output_text.delta': {
            const { delta } = event
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              updated[updated.length - 1] = { ...last, content: last.content + delta }
              return updated
            })
            break
          }

          /**
           * Response completed — the final event containing the full response.
           * See: https://platform.openai.com/docs/api-reference/responses-streaming/response/completed
           * `event.response` has the same shape as a non-streaming response,
           * including `output` (with mcp_list_tools + mcp_call items + message)
           * and `output_text` (the complete text).
           */
          case 'response.completed': {
            const { response: finalResponse } = event
            // Update the assistant message with the final response data
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              updated[updated.length - 1] = {
                ...last,
                content: finalResponse.output_text || last.content,
                responseOutput: finalResponse.output,
                rawResponse: finalResponse,
              }
              return updated
            })
            pushTrace({ id: 'stream-request', label: 'Streaming started', status: 'completed', timestamp: Date.now() })
            pushTrace({ id: 'stream-complete', label: 'Response complete', status: 'completed', timestamp: Date.now(), data: finalResponse.output })
            break
          }

          // Other events (response.created, response.in_progress, etc.)
          // are intentionally ignored to keep the code focused.
          default:
            break
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleClear() {
    setMessages([])
    clearTrace()
  }

  if (!apiKey) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <h1 className="text-2xl font-bold mb-4">Lesson 06: Remote MCP Server</h1>
        <ApiKeyConfig onKeyValidated={setApiKey} />
      </div>
    )
  }

  // Get the latest assistant message with response data
  const latestAssistantMessage = messages
    .slice()
    .reverse()
    .find((msg) => msg.role === 'assistant' && msg.rawResponse)

  return (
    <PageLayout
      title="Remote MCP Server"
      subtitle="Streaming responses with the OpenAI docs MCP server"
      chatContent={
        <ChatArea messages={messages} isLoading={isLoading} onSend={handleSend} />
      }
      inspectorContent={
        <InspectorPanels
          latestAssistantMessage={latestAssistantMessage}
          isLoading={isLoading}
          traceSteps={traceSteps}
        />
      }
      onClear={handleClear}
    />
  )
}
