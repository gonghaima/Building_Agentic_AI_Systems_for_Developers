/**
 * Lesson 05: Streaming Tool and Function Responses
 *
 * Focus: Streaming the Responses API output for real-time text + web search
 * Docs: https://platform.openai.com/docs/guides/tools-web-search
 * Streaming: https://platform.openai.com/docs/api-reference/responses-streaming
 * API Reference: https://platform.openai.com/docs/api-reference/responses/create
 *
 * This lesson demonstrates:
 * - Adding `stream: true` to the Responses API request
 *   See: https://platform.openai.com/docs/guides/function-calling#streaming
 * - Processing streaming events with `for await (const event of stream)`
 * - Handling `response.output_text.delta` to stream text in real-time
 * - Handling web search lifecycle events:
 *     response.web_search_call.in_progress → .searching → .completed
 *   See: https://platform.openai.com/docs/api-reference/responses-streaming
 * - Using `response.completed` to capture the final response object
 *
 * Builds on Lesson 04 (web search) by replacing the single await with
 * a streaming loop so the user sees text appear as it's generated.
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { ApiKeyConfig } from '@/components/ApiKeyConfig'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

// Streaming event types we handle (subset of all ResponseStreamEvent types).\n// Full list: https://platform.openai.com/docs/api-reference/responses-streaming\n// - response.web_search_call.{in_progress, searching, completed}\n// - response.output_text.delta\n// - response.completed

/**
 * Define the web search tool with domain filtering.
 * See: https://platform.openai.com/docs/guides/tools-web-search#domain-filtering
 *
 * Domain filtering lets you limit results to a specific set of domains
 * using the `filters` parameter with an `allowed_domains` array.
 * Omit the HTTP/HTTPS prefix (e.g. "wikipedia.org" not "https://wikipedia.org").
 */
const tools: OpenAI.Responses.Tool[] = [
  {
    type: 'web_search',
    // Filter so the model only searches wikipedia.org
    // See: https://platform.openai.com/docs/guides/tools-web-search#domain-filtering
    filters: {
      allowed_domains: ['wikipedia.org'],
    },
  },
]

export default function Lesson05Responses() {
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
          'Use the web_search tool only when the user asks about general knowledge or current events. ' +
          'For casual conversation or opinions, respond without searching.',
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
       * - Web search lifecycle: in_progress → searching → completed
       * - Text deltas: response.output_text.delta (append to message)
       * - Completion: response.completed (capture final response)
       */
      for await (const event of stream) {
        switch (event.type) {
          /**
           * Web search lifecycle events.
           * See: https://platform.openai.com/docs/api-reference/responses-streaming/response/web_search_call
           * These fire only when the model decides to use the web_search tool.
           * Each event has an `item_id` identifying the specific search call.
           */
          case 'response.web_search_call.in_progress':
            pushTrace({ id: `web-search-${event.item_id}`, label: 'Web search initiated', status: 'in-progress', timestamp: Date.now() })
            break

          case 'response.web_search_call.searching':
            pushTrace({ id: `web-search-${event.item_id}`, label: 'Searching the web…', status: 'in-progress', timestamp: Date.now() })
            break

          case 'response.web_search_call.completed':
            pushTrace({ id: `web-search-${event.item_id}`, label: 'Web search completed', status: 'completed', timestamp: Date.now() })
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
           * including `output` (with web_search_call items + message with annotations)
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
        <h1 className="text-2xl font-bold mb-4">Lesson 05: Streaming Web Search</h1>
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
      title="Streaming Web Search"
      subtitle="Streaming responses with web_search tool (wikipedia.org only)"
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
