/**
 * Lesson 04: Web Search via a Local Function Tool
 *
 * Focus: Giving a local model web-search ability through function calling
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md#tools
 *
 * The original version of this lesson used OpenAI's built-in `web_search`
 * tool, which runs server-side on OpenAI's infrastructure — there is no
 * local/Ollama equivalent for that. Instead, we define `search_wikipedia`
 * as a regular function tool (same pattern as Lessons 01-03) and execute
 * it ourselves against Wikipedia's free, keyless search API — matching
 * the original lesson's `wikipedia.org`-only domain filter.
 *
 * This lesson demonstrates:
 * - Wrapping a real web search API as a function tool
 * - The same request → tool call → execute → follow-up loop as Lessons 01-03,
 *   just applied to search instead of a calculator or geocoder
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

const MODEL = 'llama3.1:8b'

const SYSTEM_PROMPT =
  'Use the search_wikipedia tool only when the user asks about general knowledge or current events. ' +
  'For casual conversation or opinions, respond without searching.'

/**
 * Define the search_wikipedia function tool.
 * Chat Completions tool shape: { type: 'function', function: { name, description, parameters } }
 */
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_wikipedia',
      description: 'Search Wikipedia for a topic and return the top matching article snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query, e.g. "Eiffel Tower" or "Mixtral 8x7B"',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
]

/**
 * Search Wikipedia using its free, keyless search API.
 * `origin=*` enables CORS so this can be called directly from the browser.
 * See: https://www.mediawiki.org/wiki/API:Search
 *
 * @param query - The search query
 * @returns Array of { title, snippet, url } results
 */
async function searchWikipedia(query: string) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=${encodeURIComponent(query)}`

  const res = await fetch(url)
  const data = await res.json()

  const results = data?.query?.search ?? []
  if (results.length === 0) {
    return { error: `No Wikipedia results found for "${query}"` }
  }

  return {
    query,
    results: results.map((r: { title: string; snippet: string }) => ({
      title: r.title,
      // Strip the <span class="searchmatch"> highlighting markup from snippets
      snippet: r.snippet.replace(/<\/?span[^>]*>/g, ''),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    })),
  }
}

export default function Lesson04Responses() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { traceSteps, trace, pushTrace, clearTrace } = useTrace()

  async function handleSend(input: string) {
    setIsLoading(true)

    try {
      // Reset trace for a fresh request
      clearTrace()

      // Add user message to chat
      const userMessage: Message = { role: 'user', content: input }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)

      // Initialize OpenAI client pointed at the local Ollama server
      const client = new OpenAI({
        baseURL: 'http://127.0.0.1:11434/v1',
        apiKey: 'ollama',
        dangerouslyAllowBrowser: true, // Note: In production, use a backend proxy
      })

      pushTrace({
        id: 'initial-request',
        label: 'Sending request to model',
        status: 'in-progress',
        timestamp: Date.now(),
        data: { model: MODEL, messageCount: newMessages.length },
      })

      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ]

      let completion = await client.chat.completions.create({
        model: MODEL,
        tools,
        messages: chatMessages,
      })

      const toolCalls = (completion.choices[0].message.tool_calls ?? []).filter(
        (tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === 'function'
      )

      // Response items tagged `web_search_call` so the UI (ChatArea's
      // "tools used" detection) recognizes this as a search, like the original lesson.
      const responseOutputItems: any[] = []

      if (toolCalls.length === 0) {
        pushTrace({
          id: 'initial-request',
          label: 'Model responded (no web search)',
          status: 'completed',
          timestamp: Date.now(),
          data: completion.choices,
        })
      } else {
        pushTrace({
          id: 'initial-request',
          label: 'Model requested a Wikipedia search',
          status: 'completed',
          timestamp: Date.now(),
          data: toolCalls.map((tc) => ({
            name: tc.function.name,
            call_id: tc.id,
            arguments: JSON.parse(tc.function.arguments),
          })),
        })

        chatMessages.push(completion.choices[0].message)

        for (const toolCall of toolCalls) {
          const functionArgs = JSON.parse(toolCall.function.arguments)
          const execTraceId = `exec-${toolCall.id}`

          const execDone = trace(execTraceId, 'Searching Wikipedia…', { query: functionArgs.query })

          const result = await searchWikipedia(functionArgs.query)

          execDone('Web search completed', { query: functionArgs.query, result })

          responseOutputItems.push({
            type: 'web_search_call',
            call_id: toolCall.id,
            query: functionArgs.query,
            result,
          })

          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }

        const secondDone = trace('second-request', 'Sending search results to model', { messageCount: chatMessages.length })

        completion = await client.chat.completions.create({
          model: MODEL,
          tools,
          messages: chatMessages,
        })

        secondDone('Final response received', completion.choices)
      }

      // Extract assistant response and store full response object
      const assistantMessage: Message = {
        role: 'assistant',
        content: completion.choices[0].message.content || 'No response',
        responseOutput: responseOutputItems,
        rawResponse: completion,
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

  // Get the latest assistant message with response data
  const latestAssistantMessage = messages
    .slice()
    .reverse()
    .find((msg) => msg.role === 'assistant' && msg.rawResponse)

  return (
    <PageLayout
      title="Web Search"
      subtitle="Local search_wikipedia function tool (wikipedia.org only)"
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
