/**
 * Lesson 03: Handling Multiple Function Calls and Responses
 *
 * Focus: Multiple function tools in a single conversation
 * Docs: https://platform.openai.com/docs/guides/function-calling
 * API Reference: https://platform.openai.com/docs/api-reference/responses/create
 *
 * This lesson demonstrates:
 * - Defining multiple function tools with JSON schema
 * - Handling multiple function calls in a single response
 * - Chaining tool results (geocode → weather)
 * - Calling external APIs (Nominatim + OpenWeatherMap)
 *
 * Functions:
 * - geocode_location: Look up lat/lon for a location string
 * - get_current_weather: Get current weather using lat/lon from OpenWeatherMap
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
 * Define the function tools available to the model
 * See: https://platform.openai.com/docs/guides/function-calling#defining-functions
 *
 * Two tools are defined:
 * 1. geocode_location — resolve a place name to lat/lon
 * 2. get_current_weather — fetch weather for a given lat/lon
 *
 * The model can call both in sequence (geocode first, then weather)
 * or in parallel if it already has coordinates.
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
  {
    type: 'function' as const,
    name: 'get_current_weather',
    description:
      'Get the current weather for a location given its latitude and longitude. Returns temperature, humidity, and weather description.',
    parameters: {
      type: 'object' as const,
      properties: {
        latitude: {
          type: 'number' as const,
          description: 'Latitude of the location',
        },
        longitude: {
          type: 'number' as const,
          description: 'Longitude of the location',
        },
      },
      required: ['latitude', 'longitude'],
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

/**
 * Fetch current weather from Open-Meteo API (no API key required)
 * See: https://open-meteo.com/en/docs
 *
 * @param latitude - Latitude of the location
 * @param longitude - Longitude of the location
 * @returns Object with temperature, humidity, description, and other weather data
 */
async function getCurrentWeather(latitude: number, longitude: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.error) {
      return { error: `Weather API error: ${data.reason || 'Unknown error'}` }
    }

    // Map WMO weather codes to human-readable descriptions
    // See: https://open-meteo.com/en/docs#weathervariables
    const weatherDescriptions: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
    }

    const current = data.current
    return {
      latitude,
      longitude,
      temperature_celsius: current?.temperature_2m,
      feels_like_celsius: current?.apparent_temperature,
      humidity_percent: current?.relative_humidity_2m,
      description: weatherDescriptions[current?.weather_code] ?? `Weather code ${current?.weather_code}`,
      wind_speed_kmh: current?.wind_speed_10m,
    }
  } catch (err) {
    return { error: `Failed to fetch weather: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}

export default function Lesson03Responses() {
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
          `You have access to geocode_location and get_current_weather tools. 
          When the user asks about weather in a new location:
          first use geocode_location to get coordinates, 
          then use get_current_weather with those coordinates. 
          When the user only asks about a location or coordinates, use geocode_location alone. 
          If you already have weather data in your context for the location in question, use that directly without calling the tool again.
          Always call the appropriate tool(s) before providing your response.`,
        tools,
        input: newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      })

      /**
       * Step 2: Tool-calling loop
       * See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
       *
       * The model may need multiple rounds of tool calls. For example:
       *   Round 1: geocode_location("Paris") → returns lat/lon
       *   Round 2: get_current_weather(lat, lon) → returns weather data
       *   Round 3: model generates final text response
       *
       * We loop until the model stops returning function_call items.
       */

      // Build a running input list we will add to over time
      // See: https://platform.openai.com/docs/guides/function-calling (complete tool calling example)
      const inputList: any[] = [
        ...newMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ]

      // Store function trace data for inspector panel
      let functionTraceData: any = null
      const allFunctionExecutions: any[] = []
      let roundNumber = 0

      // Loop while the model keeps requesting function calls
      while (true) {
        const functionCalls = response.output.filter(
          (item) => item.type === 'function_call'
        )

        if (functionCalls.length === 0) {
          // No function calls — model responded directly with text
          pushTrace({
            id: `round-${roundNumber}-done`,
            label: roundNumber === 0
              ? 'Model responded (no tool calls)'
              : 'Final response received',
            status: 'completed',
            timestamp: Date.now(),
            data: response.output,
          })
          break
        }

        roundNumber++

        // --- Trace: model detected function call(s) ---
        pushTrace({
          id: `round-${roundNumber}-calls`,
          label: `Round ${roundNumber}: ${functionCalls.length} tool call(s)`,
          status: 'completed',
          timestamp: Date.now(),
          data: functionCalls.map((fc: any) => ({
            name: fc.name,
            call_id: fc.call_id,
            arguments: JSON.parse(fc.arguments),
          })),
        })

        // Append the model's output (including function calls) to input list
        // See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
        inputList.push(...response.output)

        /**
         * Step 3: Execute each function call and collect outputs
         * See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
         */
        for (const toolCall of functionCalls) {
          if (toolCall.type === 'function_call') {
            const functionName = toolCall.name
            const functionArgs = JSON.parse(toolCall.arguments)
            const execTraceId = `exec-${toolCall.call_id}`

            const execDone = trace(execTraceId, `Executing ${functionName}()`, { function: functionName, arguments: functionArgs })

            /**
             * Route each function call to the appropriate handler.
             * See: https://platform.openai.com/docs/guides/function-calling#handling-function-calls
             */
            let result
            if (functionName === 'geocode_location') {
              console.log('Executing geocode_location with args:', functionArgs)
              result = await geocodeLocation(functionArgs.location)
            } else if (functionName === 'get_current_weather') {
              console.log('Executing get_current_weather with args:', functionArgs)
              result = await getCurrentWeather(functionArgs.latitude, functionArgs.longitude)
            }

            // --- Trace: function completed ---
            execDone(`${functionName}() returned`, { function: functionName, arguments: functionArgs, result })

            allFunctionExecutions.push({
              round: roundNumber,
              call_id: toolCall.call_id,
              function_name: functionName,
              arguments: functionArgs,
              result: result,
            })

            /**
             * Step 4: Append function call output to input list
             * See: https://platform.openai.com/docs/guides/function-calling#formatting-results
             */
            inputList.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify(result),
            })
          }
        }

        /**
         * Step 5: Send results back to the model
         * The model may respond with more tool calls or a final text response.
         * See: https://platform.openai.com/docs/guides/function-calling#incorporating-results-into-response
         */
        const followupDone = trace(`round-${roundNumber}-followup`, `Sending round ${roundNumber} results to model`, { inputItemCount: inputList.length })

        response = await client.responses.create({
          model: 'gpt-5',
          instructions:
            'You have access to geocode_location and get_current_weather tools. ' +
            'When the user asks about weather, first use geocode_location to get coordinates, ' +
            'then use get_current_weather with those coordinates. ' +
            'When the user only asks about a location or coordinates, use geocode_location alone. ' +
            'Always call the appropriate tool(s) before providing your response.',
          tools,
          input: inputList,
        })

        followupDone(`Round ${roundNumber} response received`, response.output)
      }

      // Build function trace for inspector (if any tool calls were made)
      if (allFunctionExecutions.length > 0) {
        functionTraceData = {
          total_rounds: roundNumber,
          function_executions: allFunctionExecutions,
          final_input: inputList,
        }
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
        <h1 className="text-2xl font-bold mb-4">Lesson 03: Multiple Function Calls</h1>
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
      title="Geocoding + Weather"
      subtitle="Multiple function calls example"
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
