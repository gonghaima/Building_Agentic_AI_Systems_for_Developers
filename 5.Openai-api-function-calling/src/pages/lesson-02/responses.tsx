/**
 * Lesson 02: External API Integration - Nominatim Geocoding
 *
 * Focus: Using function calling to call an external API
 * Docs: https://platform.openai.com/docs/guides/function-calling
 * API Reference: https://platform.openai.com/docs/api-reference/responses/create
 *
 * This lesson demonstrates:
 * - Defining function tools with JSON schema
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
import { ApiKeyConfig } from '@/components/ApiKeyConfig'
import { ChatArea } from '@/components/ChatArea'
import { PageLayout } from '@/components/PageLayout'
import { InspectorPanels } from '@/components/InspectorPanels'
import { useTrace } from '@/hooks/useTrace'
import type { Message } from '@/types/chat'

/**
 * Define the geocode_location function tool
 * See: https://platform.openai.com/docs/guides/function-calling#defining-functions
 *
 * Accepts city names ("Paris"), addresses ("1600 Amphitheatre Parkway, Mountain View, CA"),
 * or landmarks ("Eiffel Tower", "Statue of Liberty").
 */
const tools = [
  {
    type: 'function' as const,
    name: 'geocode_location',
    description:
      'Look up the latitude and longitude of a location. Accepts city names (e.g. "New York"), specific addresses (e.g. "1600 Amphitheatre Parkway, Mountain View, CA"), or landmarks (e.g. "Eiffel Tower").',
    parameters: {
      type: 'object' as const,
      properties: {
        location: {
          type: 'string' as const,
          description: 'The location to geocode — a city name, street address, or landmark name',
        },
      },
      required: ['location'],
      additionalProperties: false,
    },
    strict: false,
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

      /**
       * Step 1: Make initial request with tools defined
       * See: https://platform.openai.com/docs/guides/function-calling#the-tool-calling-flow
       *
       * The model examines the prompt and available tools, and may respond with:
       * - A text response (if no tool is needed)
       * - One or more function calls (if tools are needed)
       */
      // --- Trace: sending initial request ---
      pushTrace({
        id: 'initial-request',
        label: 'Sending request to model',
        status: 'in-progress',
        timestamp: Date.now(),
        data: { model: 'gpt-5', messageCount: newMessages.length },
      })

      let response = await client.responses.create({
        model: 'gpt-5',
        instructions:
          'You have access to the geocode_location tool to look up coordinates. Use this tool when the user asks about the location, coordinates, or position of a place. Always call the tool before providing your response.',
        tools,
        input: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      })

      /**
       * Step 2: Check for function calls in the response
       * See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
       *
       * The response.output array may contain items with type 'function_call'.
       * Each function call has: call_id, name, and arguments (JSON string).
       */
      const functionCalls = response.output.filter(
        (item) => item.type === 'function_call'
      )

      // Store function trace data for inspector panel
      let functionTraceData: any = null

      if (functionCalls.length === 0) {
        // No function calls — model responded directly
        pushTrace({
          id: 'initial-request',
          label: 'Model responded (no tool calls)',
          status: 'completed',
          timestamp: Date.now(),
          data: response.output,
        })
      }

      if (functionCalls.length > 0) {
        // --- Trace: model detected function call(s) ---
        pushTrace({
          id: 'initial-request',
          label: 'Model requested function call(s)',
          status: 'completed',
          timestamp: Date.now(),
          data: functionCalls.map((fc: any) => ({
            name: fc.name,
            call_id: fc.call_id,
            arguments: JSON.parse(fc.arguments),
          })),
        })

        // Capture the initial response with function calls
        const initialResponse = response

        // Build input list for second request — start with original messages
        // See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
        const inputList = [
          ...newMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          ...response.output, // Include the model's output (with function calls)
        ]

        // Track function executions for the trace
        const functionExecutions: any[] = []

        /**
         * Step 3: Execute each function call and collect outputs
         * See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
         *
         * Unlike Lesson 01, this function is async because it calls an external API.
         */
        for (const toolCall of functionCalls) {
          if (toolCall.type === 'function_call') {
            const functionName = toolCall.name
            const functionArgs = JSON.parse(toolCall.arguments)
            const execTraceId = `exec-${toolCall.call_id}`

            const execDone = trace(execTraceId, `Executing ${functionName}()`, { function: functionName, arguments: functionArgs })

            // Execute the function based on its name
            let result
            if (functionName === 'geocode_location') {
              console.log('Executing geocode_location with args:', functionArgs)
              result = await geocodeLocation(functionArgs.location)
            }

            // --- Trace: function completed ---
            execDone(`${functionName}() returned`, { function: functionName, arguments: functionArgs, result })

            // Store execution details for trace
            functionExecutions.push({
              call_id: toolCall.call_id,
              function_name: functionName,
              arguments: functionArgs,
              result: result,
            })

            /**
             * Step 4: Append function call output to input list
             * See: https://platform.openai.com/docs/guides/function-calling#formatting-results
             *
             * Format: function_call_output with call_id reference and stringified output
             */
            inputList.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify(result),
            } as any) // Type cast needed for SDK compatibility
          }
        }

        // Build function trace for inspector
        functionTraceData = {
          step_1_initial_response: initialResponse.output,
          step_2_function_executions: functionExecutions,
          step_3_input_with_results: inputList,
        }

        /**
         * Step 5: Make second request with function outputs
         * The model uses the geocoding results to generate a final text response.
         */
        const secondDone = trace('second-request', 'Sending function results to model', { inputItemCount: inputList.length })

        response = await client.responses.create({
          model: 'gpt-5',
          instructions:
            'You have access to the geocode_location tool to look up coordinates. Use this tool when the user asks about the location, coordinates, or position of a place. Always call the tool before providing your response.',
          tools,
          input: inputList,
        })

        secondDone('Final response received', response.output)
      }

      // Extract assistant response and store full response object
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.output_text || 'No response',
        responseOutput: response.output,
        rawResponse: response, // Store full response for inspection panel
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

  if (!apiKey) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <h1 className="text-2xl font-bold mb-4">Lesson 02: Geocoding (Function Calling)</h1>
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
