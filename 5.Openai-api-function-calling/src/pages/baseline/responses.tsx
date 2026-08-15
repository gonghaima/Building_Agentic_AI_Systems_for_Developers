/**
 * Baseline: Basic Chat with History
 * 
 * Focus: Simple chat interface using OpenAI Responses API
 * Docs: https://platform.openai.com/docs/api-reference/responses/create
 * 
 * This baseline lesson demonstrates:
 * - Basic message history management
 * - Simple request/response flow
 * - No function calling yet - just plain chat
 */

import { useState } from 'react'
import OpenAI from 'openai'
import { ApiKeyConfig } from '@/components/ApiKeyConfig'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

export default function BaselineResponses() {
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

      const done = trace('request', 'Sending request to model', { model: 'gpt-5', messageCount: newMessages.length })

      // Call OpenAI Responses API
      // See: https://platform.openai.com/docs/api-reference/responses/create
      const response = await client.responses.create({
        model: 'gpt-5',
        input: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      })

      done('Response received', response.output)

      // Extract assistant response and store full response object
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.output_text || 'No response',
        responseOutput: response.output,
        rawResponse: response, // Store full response for inspection panel
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
        <h1 className="text-2xl font-bold mb-4">Basic Chat (Responses API)</h1>
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
