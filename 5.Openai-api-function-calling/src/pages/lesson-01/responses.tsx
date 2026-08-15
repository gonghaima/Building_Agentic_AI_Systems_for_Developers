/**
 * Lesson 01: Basic Function Calling - Tip Calculator
 * 
 * Focus: Implementing function calling with OpenAI Responses API
 * Docs: https://platform.openai.com/docs/guides/function-calling
 * API Reference: https://platform.openai.com/docs/api-reference/responses/create
 * 
 * This lesson demonstrates:
 * - Defining function tools with JSON schema
 * - Handling function calls from model responses
 * - Executing functions and returning results
 * - Multi-step conversation flow with tool calling
 * 
 * Function: calculate_tip
 * - Takes bill_amount (required) and tip_percentage (optional, default 20%)
 * - Returns bill details including tip amount and total
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
 * Define the tip calculator function tool
 * See: https://platform.openai.com/docs/guides/function-calling#defining-functions
 * 
 * Following best practices:
 * - Clear, detailed function name and descriptions
 * - Explicit parameter descriptions with format details
 * - Required vs optional parameters specified
 */
const tools = [
  {
    type: 'function' as const,
    name: 'calculate_tip',
    description: 'Calculate tip amount and total bill. Takes a bill amount and optional tip percentage (defaults to 20%).',
    parameters: {
      type: 'object' as const,
      properties: {
        bill_amount: {
          type: 'number' as const,
          description: 'The original bill amount in dollars (e.g., 50.00)',
        },
        tip_percentage: {
          type: 'number' as const,
          description: 'The tip percentage to apply (e.g., 20 for 20%). Defaults to 20 if not provided.',
        },
      },
      required: ['bill_amount'],
      additionalProperties: false,
    },
    strict: false,
  },
]

/**
 * Tip calculator function implementation
 * 
 * @param bill_amount - Original bill amount
 * @param tip_percentage - Tip percentage (defaults to 20%)
 * @returns Object with bill details including tip and total
 */
function calculateTip(bill_amount: number, tip_percentage: number = 20) {
  const tipAmount = (bill_amount * tip_percentage) / 100
  const totalAmount = bill_amount + tipAmount

  return {
    original_bill: bill_amount,
    tip_percentage: tip_percentage,
    tip_amount: parseFloat(tipAmount.toFixed(2)),
    total_amount: parseFloat(totalAmount.toFixed(2)),
  }
}

export default function BaselineResponses() {
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
       * The model will examine the prompt and available tools, and may respond with:
       * - A text response (if no tool is needed)
       * - One or more function calls (if tools are needed)
       */
      pushTrace({
        id: 'initial-request',
        label: 'Sending request to model',
        status: 'in-progress',
        timestamp: Date.now(),
        data: { model: 'gpt-5', messageCount: newMessages.length },
      })

      let response = await client.responses.create({
        model: 'gpt-5',
        instructions: 'You have access to the calculate_tip tool to compute tip amounts. Use this tool when the user asks for tip calculations. Always call the appropriate tool before providing your response.',
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
       * The response.output array may contain items with type 'function_call'
       * Each function call has: call_id, name, and arguments (JSON string)
       */
      const functionCalls = response.output.filter((item) => item.type === 'function_call')

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
        
        // Build input list for second request - start with original messages
        const inputList = [
          ...newMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          ...response.output, // Include the model's output (with function calls)
        ]
        console.log(response)
        // Track function executions for the trace
        const functionExecutions: any[] = []

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

            // Execute the function based on its name
            let result
            if (functionName === 'calculate_tip') {
              console.log('Executing calculate_tip with args:', functionArgs)
              result = calculateTip(functionArgs.bill_amount, functionArgs.tip_percentage)
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
             * Format: function_call_output with call_id reference and output string
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
         * The model will use the function results to generate a final text response
         */
        const secondDone = trace('second-request', 'Sending function results to model', { inputItemCount: inputList.length })

        response = await client.responses.create({
          model: 'gpt-5',
          instructions: 'You have access to the calculate_tip tool to compute tip amounts. Use this tool when the user asks for tip calculations. Always call the appropriate tool before providing your response.',
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
        functionCall: functionTraceData ? {
          name: 'function_trace',
          arguments: JSON.stringify(functionTraceData),
          status: 'completed',
          response: functionTraceData,
        } : undefined,
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
        <h1 className="text-2xl font-bold mb-4">Lesson 01: Tip Calculator (Function Calling)</h1>
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
      title="Tip Calculator"
      subtitle="Basic function calling example"
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
