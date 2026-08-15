/**
 * Lesson 06: Remote MCP Server (stubbed for local models)
 *
 * Focus: Why MCP's built-in tool doesn't have a local equivalent
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md
 *
 * The original version of this lesson used OpenAI's built-in `mcp` tool,
 * which connects the model to a *remote* MCP server entirely server-side —
 * OpenAI's infrastructure discovers the server's tools, calls them, and
 * feeds results back into the model automatically. Ollama's OpenAI-compatible
 * endpoint only exposes Chat Completions; it has no concept of a built-in
 * `mcp` tool, and there's no practical way to replicate "OpenAI's servers
 * talk to a remote MCP server for you" using a local model.
 *
 * A real local equivalent would mean running an MCP *client* in this app
 * (e.g. the `@modelcontextprotocol/sdk` package) that connects to an MCP
 * server, lists its tools, converts them into Chat Completions function
 * tools, and drives the same tool-calling loop as Lessons 01-03. That's a
 * legitimate follow-up project, but out of scope for swapping this lesson
 * to a local model — so this page is stubbed down to plain streaming chat
 * via Ollama, with no MCP tool involved.
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

const MODEL = 'llama3.1:8b'

export default function Lesson06Responses() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { traceSteps, pushTrace, clearTrace } = useTrace()

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

      // Mark the streaming request in the trace panel
      pushTrace({ id: 'stream-request', label: 'Streaming response…', status: 'in-progress', timestamp: Date.now(), data: { model: MODEL, messageCount: newMessages.length } })

      /**
       * Plain streaming chat — no MCP tool. See file header for why.
       * See: https://github.com/ollama/ollama/blob/main/docs/openai.md#streaming
       */
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        stream: true,
      })

      // Add an empty assistant message that we'll update incrementally
      // as text chunks arrive.
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      let fullText = ''
      let finalCompletion: unknown = null
      for await (const chunk of stream) {
        finalCompletion = chunk
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
      pushTrace({ id: 'stream-complete', label: 'Response complete', status: 'completed', timestamp: Date.now() })

      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = {
          ...last,
          content: fullText || last.content,
          rawResponse: finalCompletion,
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
      title="Remote MCP Server"
      subtitle="Stubbed: local models can't reach OpenAI's built-in MCP tool"
      chatContent={
        <div className="flex h-full flex-col min-h-0">
          <Alert className="m-4 mb-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The original lesson used OpenAI's built-in <code>mcp</code> tool to reach a
              remote MCP server server-side. Ollama has no equivalent, so this page is plain
              streaming chat with no tools — see the file header comment for what a real
              local MCP client would require.
            </AlertDescription>
          </Alert>
          <div className="flex-1 min-h-0">
            <ChatArea messages={messages} isLoading={isLoading} onSend={handleSend} />
          </div>
        </div>
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
