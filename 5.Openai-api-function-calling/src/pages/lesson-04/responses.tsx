/**
 * Lesson 04: Using Built-in Tools — Web Search
 *
 * Focus: Using the built-in web_search tool with the OpenAI Responses API
 * Docs: https://platform.openai.com/docs/guides/tools-web-search
 * API Reference: https://platform.openai.com/docs/api-reference/responses/create
 *
 * This lesson demonstrates:
 * - Adding the web_search built-in tool to a Responses API request
 * - Domain filtering to restrict search results to wikipedia.org
 * - Key difference from function calling: the model runs the tool
 *   server-side — no back-and-forth loop is required
 *
 * Unlike regular function calls (Lessons 01-03), built-in tools like
 * web_search are executed by the model automatically. We simply include
 * the tool in the request and receive the final response directly.
 * See: https://platform.openai.com/docs/guides/tools-web-search
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { ApiKeyConfig } from '@/components/ApiKeyConfig'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

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

export default function Lesson04Responses() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { traceSteps, trace, clearTrace } = useTrace()
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

      const done = trace('web-search-request', 'Sending request with possible `web_search` tool', { model: 'gpt-5', messageCount: newMessages.length })

      /**
       * Make the request with the web_search built-in tool.
       * See: https://platform.openai.com/docs/guides/tools-web-search
       *
       * KEY DIFFERENCE: Unlike function tools (Lessons 01-03), the model
       * executes the web search on its own — there is no multi-step
       * back-and-forth loop. We send one request and receive the final
       * response (which may include a `web_search_call` output item
       * alongside the assistant message).
       */
      const response = await client.responses.create({
        model: 'gpt-5',
        tools,
        instructions:
          'Use the web_search tool only when the user asks about general knowledge or current events. ' +
          'For casual conversation or opinions, respond without searching.',
        input: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      })

      /**
       * The response output may include:
       * - A `web_search_call` item (with search action details)
       * - A `message` item with text and url_citation annotations
       * See: https://platform.openai.com/docs/guides/tools-web-search#output-and-citations
       */
      const webSearchCalls = response.output.filter(
        (item) => item.type === 'web_search_call'
      )

      if (webSearchCalls.length > 0) {
        done('Web search completed by model', webSearchCalls)
      } else {
        done('Model responded (no web search)', response.output)
      }

      // Extract assistant response and store full response object
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.output_text || 'No response',
        responseOutput: response.output,
        rawResponse: response,
      }

      setMessages([...newMessages, assistantMessage])
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
        <h1 className="text-2xl font-bold mb-4">Lesson 04: Web Search (Built-in Tool)</h1>
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
      title="Web Search"
      subtitle="Built-in web_search tool (wikipedia.org only)"
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
