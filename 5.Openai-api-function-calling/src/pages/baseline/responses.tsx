/**
 * Baseline: Basic Chat with History
 *
 * Focus: Simple chat interface using a local model served by Ollama
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md
 *
 * This baseline lesson demonstrates:
 * - Basic message history management
 * - Simple request/response flow via Ollama's OpenAI-compatible Chat Completions endpoint
 * - No function calling yet - just plain chat
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

const MODEL = 'llama3.1:8b'

export default function BaselineResponses() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { traceSteps, trace, clearTrace } = useTrace()

  async function handleSend(input: string) {
    setIsLoading(true)

    try {
      clearTrace()

      // Add user message to chat
      const userMessage: Message = { role: 'user', content: input }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)

      // Initialize OpenAI client pointed at the local Ollama server
      const client = new OpenAI({
        baseURL: 'http://127.0.0.1:11434/v1',
        apiKey: 'ollama', // Ollama ignores the key, but the SDK requires one
        dangerouslyAllowBrowser: true, // Note: In production, use a backend proxy
      })

      const done = trace('request', 'Sending request to model', { model: MODEL, messageCount: newMessages.length })

      // Call Ollama's OpenAI-compatible Chat Completions endpoint
      // See: https://github.com/ollama/ollama/blob/main/docs/openai.md
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      })

      done('Response received', completion.choices)

      // Extract assistant response and store full response object
      const assistantMessage: Message = {
        role: 'assistant',
        content: completion.choices[0].message.content || 'No response',
        responseOutput: completion.choices,
        rawResponse: completion, // Store full response for inspection panel
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
      title="Chat"
      subtitle="Function calling playground"
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
