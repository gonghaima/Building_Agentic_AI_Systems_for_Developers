/**
 * Lesson 02: External API Integration - Nominatim Geocoding
 *
 * Focus: Using function calling to call an external API
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md#tools
 *
 * This lesson demonstrates:
 * - Defining function tools with JSON schema (Chat Completions shape)
 * - Calling an external API (Nominatim/OpenStreetMap) from a function tool
 * - Handling async function execution in the tool-calling loop
 * - Multi-step conversation flow with tool calling
 *
 * Function: geocode_location
 * - Takes a location string (city, address, or landmark)
 * - Calls the Nominatim API to get latitude and longitude
 * - Returns coordinates and display name
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
  'You have access to the geocode_location tool to look up coordinates. Use this tool when the user asks about the location, coordinates, or position of a place. Always call the tool before providing your response.'

/**
 * Define the geocode_location function tool.
 * Chat Completions tool shape: { type: 'function', function: { name, description, parameters } }
 *
 * Accepts city names ("Paris"), addresses ("1600 Amphitheatre Parkway, Mountain View, CA"),
 * or landmarks ("Eiffel Tower", "Statue of Liberty").
 */
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'geocode_location',
      description:
        'Look up the latitude and longitude of a location. Accepts city names (e.g. "New York"), specific addresses (e.g. "1600 Amphitheatre Parkway, Mountain View, CA"), or landmarks (e.g. "Eiffel Tower").',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to geocode — a city name, street address, or landmark name',
          },
        },
        required: ['location'],
        additionalProperties: false,
      },
    },
  },
]

/**
 * Geocode a location using the Nominatim (OpenStreetMap) API
 * No API key required — just a User-Agent header.
 * See: https://nominatim.org/release-docs/develop/api/Search/
 *
 * @param location - City name, street address, or landmark
 * @returns Object with location, latitude, longitude, and display_name
 */
async function geocodeLocation(location: string) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'OpenAI-Function-Calling-Course/1.0' },
  })

  const data = await res.json()

  if (!data || data.length === 0) {
    return { error: `No results found for "${location}"` }
  }

  return {
    location,
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    display_name: data[0].display_name,
  }
}

export default function Lesson02Responses() {
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

      /**
       * Step 1: Make initial request with tools defined
       *
       * The model examines the prompt and available tools, and may respond with:
       * - A text response (if no tool is needed)
       * - One or more tool calls (if tools are needed)
       */
      // --- Trace: sending initial request ---
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

      /**
       * Step 2: Check for tool calls in the response
       *
       * `completion.choices[0].message.tool_calls` is populated when the model
       * wants to call one or more tools.
       */
      let toolCalls = (completion.choices[0].message.tool_calls ?? []).filter(
        (tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === 'function'
      )

      // Store function trace data for inspector panel
      let functionTraceData: any = null

      if (toolCalls.length === 0) {
        // No tool calls — model responded directly
        pushTrace({
          id: 'initial-request',
          label: 'Model responded (no tool calls)',
          status: 'completed',
          timestamp: Date.now(),
          data: completion.choices,
        })
      }

      // Response items shaped like the old Responses API so the UI (ChatArea's
      // "tools used" detection) keeps working unchanged.
      const responseOutputItems: any[] = []

      if (toolCalls.length > 0) {
        // --- Trace: model detected tool call(s) ---
        pushTrace({
          id: 'initial-request',
          label: 'Model requested function call(s)',
          status: 'completed',
          timestamp: Date.now(),
          data: toolCalls.map((tc) => ({
            name: tc.function.name,
            call_id: tc.id,
            arguments: JSON.parse(tc.function.arguments),
          })),
        })

        // Capture the initial response with tool calls
        const initialResponse = completion

        // Append the assistant's tool-call message to the running conversation
        chatMessages.push(completion.choices[0].message)

        // Track function executions for the trace
        const functionExecutions: any[] = []

        /**
         * Step 3: Execute each tool call and append results
         *
         * Unlike Lesson 01, this function is async because it calls an external API.
         */
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)
          const execTraceId = `exec-${toolCall.id}`

          const execDone = trace(execTraceId, `Executing ${functionName}()`, { function: functionName, arguments: functionArgs })

          // Execute the function based on its name
          let result
          if (functionName === 'geocode_location') {
            console.log('Executing geocode_location with args:', functionArgs)
            result = await geocodeLocation(functionArgs.location)
          }

          // --- Trace: function completed ---
          execDone(`${functionName}() returned`, { function: functionName, arguments: functionArgs, result })

          functionExecutions.push({
            call_id: toolCall.id,
            function_name: functionName,
            arguments: functionArgs,
            result: result,
          })

          responseOutputItems.push(
            { type: 'function_call', call_id: toolCall.id, name: functionName, arguments: toolCall.function.arguments },
            { type: 'function_call_output', call_id: toolCall.id, output: JSON.stringify(result) }
          )

          /**
           * Step 4: Append the tool result as a `role: 'tool'` message
           */
          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }

        // Build function trace for inspector
        functionTraceData = {
          step_1_initial_response: initialResponse.choices,
          step_2_function_executions: functionExecutions,
          step_3_messages_with_results: chatMessages,
        }

        /**
         * Step 5: Make second request with function outputs
         * The model uses the geocoding results to generate a final text response.
         */
        const secondDone = trace('second-request', 'Sending function results to model', { messageCount: chatMessages.length })

        completion = await client.chat.completions.create({
          model: MODEL,
          tools,
          messages: chatMessages,
        })

        secondDone('Final response received', completion.choices)

        toolCalls = (completion.choices[0].message.tool_calls ?? []).filter(
          (tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === 'function'
        )
      }

      // Extract assistant response and store full response object
      const assistantMessage: Message = {
        role: 'assistant',
        content: completion.choices[0].message.content || 'No response',
        responseOutput: responseOutputItems,
        rawResponse: completion, // Store full response for inspection panel
        functionCall: functionTraceData
          ? {
              name: 'function_trace',
              arguments: JSON.stringify(functionTraceData),
              status: 'completed',
              response: functionTraceData,
            }
          : undefined,
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
      title="Geocoding"
      subtitle="External API function calling example"
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
