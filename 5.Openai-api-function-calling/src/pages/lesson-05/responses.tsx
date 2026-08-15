/**
 * Lesson 05: Streaming Tool and Function Responses
 *
 * Focus: Streaming Chat Completions output for real-time text + web search
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md#streaming
 *
 * Builds on Lesson 04 (Wikipedia search function tool) by streaming the
 * final answer so the user sees text appear as it's generated.
 *
 * Ollama's OpenAI-compatible endpoint streams tool calls in the same
 * response as text deltas, which makes streaming the *first* (tool-decision)
 * round awkward to reason about for a teaching example. Instead we:
 *   1. Make a normal (non-streaming) request with tools to see whether the
 *      model wants to search Wikipedia — same as Lesson 04.
 *   2. If it does, execute the search and append the tool result.
 *   3. Make a second request with `stream: true` for the final answer and
 *      append each text delta to the assistant message as it arrives.
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
      snippet: r.snippet.replace(/<\/?span[^>]*>/g, ''),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    })),
  }
}

export default function Lesson05Responses() {
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

      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ]

      /**
       * Step 1: Non-streaming request to decide whether a search is needed.
       */
      const decisionDone = trace('tool-decision', 'Checking whether a Wikipedia search is needed…', { model: MODEL, messageCount: newMessages.length })

      const completion = await client.chat.completions.create({
        model: MODEL,
        tools,
        messages: chatMessages,
      })

      const toolCalls = (completion.choices[0].message.tool_calls ?? []).filter(
        (tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === 'function'
      )
      const responseOutputItems: any[] = []

      if (toolCalls.length > 0) {
        decisionDone('Model requested a Wikipedia search', toolCalls.map((tc) => ({ name: tc.function.name, arguments: JSON.parse(tc.function.arguments) })))

        chatMessages.push(completion.choices[0].message)

        for (const toolCall of toolCalls) {
          const functionArgs = JSON.parse(toolCall.function.arguments)

          pushTrace({ id: `web-search-${toolCall.id}`, label: 'Searching Wikipedia…', status: 'in-progress', timestamp: Date.now() })

          const result = await searchWikipedia(functionArgs.query)

          pushTrace({ id: `web-search-${toolCall.id}`, label: 'Web search completed', status: 'completed', timestamp: Date.now(), data: result })

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
      } else {
        decisionDone('No search needed', completion.choices)
      }

      /**
       * Step 2: Streamed final answer.
       * See: https://github.com/ollama/ollama/blob/main/docs/openai.md#streaming
       */
      pushTrace({ id: 'stream-request', label: 'Streaming response…', status: 'in-progress', timestamp: Date.now(), data: { model: MODEL, messageCount: chatMessages.length } })

      const stream = await client.chat.completions.create({
        model: MODEL,
        messages: chatMessages,
        stream: true,
      })

      // Add an empty assistant message that we'll update incrementally
      // as text chunks arrive.
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      let fullText = ''
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          fullText += delta
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            updated[updated.length - 1] = { ...last, content: last.content + delta }
            return updated
          })
        }
      }

      pushTrace({ id: 'stream-request', label: 'Streaming started', status: 'completed', timestamp: Date.now() })
      pushTrace({ id: 'stream-complete', label: 'Response complete', status: 'completed', timestamp: Date.now(), data: responseOutputItems })

      // Finalize the assistant message with the full response data
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = {
          ...last,
          content: fullText || last.content,
          responseOutput: responseOutputItems,
          rawResponse: completion,
        }
        return updated
      })
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
      title="Streaming Web Search"
      subtitle="Streaming responses with local search_wikipedia tool (wikipedia.org only)"
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
