/**
 * Lesson 01: Basic Function Calling - Tip Calculator
 *
 * Focus: Implementing function calling with a local model served by Ollama
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md#tools
 *
 * This lesson demonstrates:
 * - Defining function tools with JSON schema (Chat Completions shape)
 * - Handling tool calls from model responses
 * - Executing functions and returning results
 * - Multi-step conversation flow with tool calling
 *
 * Function: calculate_tip
 * - Takes bill_amount (required) and tip_percentage (optional, default 20%)
 * - Returns bill details including tip amount and total
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
  'You have access to the calculate_tip tool to compute tip amounts. Use this tool when the user asks for tip calculations. Always call the appropriate tool before providing your response. Pass tip_percentage as a whole number like 20 for 20%, not a decimal like 0.2.'

/**
 * Define the tip calculator function tool.
 * Chat Completions tool shape: { type: 'function', function: { name, description, parameters } }
 * See: https://github.com/ollama/ollama/blob/main/docs/openai.md#tools
 *
 * Following best practices:
 * - Clear, detailed function name and descriptions
 * - Explicit parameter descriptions with format details
 * - Required vs optional parameters specified
 */
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'calculate_tip',
      description:
        'Calculate tip amount and total bill. Takes a bill amount and optional tip percentage (defaults to 20%).',
      parameters: {
        type: 'object',
        properties: {
          bill_amount: {
            type: 'number',
            description: 'The original bill amount in dollars (e.g., 50.00)',
          },
          tip_percentage: {
            type: 'number',
            description: 'The tip percentage to apply (e.g., 20 for 20%). Defaults to 20 if not provided.',
          },
        },
        required: ['bill_amount'],
        additionalProperties: false,
      },
    },
  },
]

/**
 * Tip calculator function implementation.
 * Local models sometimes send numbers as strings or as fractions (0.2
 * instead of 20), so we coerce defensively before doing the math.
 *
 * @param billAmount - Original bill amount
 * @param tipPercentage - Tip percentage (defaults to 20%)
 * @returns Object with bill details including tip and total
 */
function calculateTip(billAmount: number, tipPercentage: number = 20) {
  const bill = Number(billAmount)
  let pct = Number(tipPercentage)
  if (pct > 0 && pct <= 1) pct *= 100 // model sent a fraction like 0.2 instead of 20

  const tipAmount = (bill * pct) / 100
  const totalAmount = bill + tipAmount

  return {
    original_bill: bill,
    tip_percentage: pct,
    tip_amount: parseFloat(tipAmount.toFixed(2)),
    total_amount: parseFloat(totalAmount.toFixed(2)),
  }
}

export default function BaselineResponses() {
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
       * The model will examine the prompt and available tools, and may respond with:
       * - A text response (if no tool is needed)
       * - One or more tool calls (if tools are needed)
       */
      pushTrace({
        id: 'initial-request',
        label: 'Sending request to model',
        status: 'in-progress',
        timestamp: Date.now(),
        data: { model: MODEL, messageCount: newMessages.length },
      })

      // Running message list — the Chat Completions API is stateless, so we
      // resend the full conversation (system + history + tool results) each round.
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
       * wants to call one or more tools. Each entry has: id, and function.{name, arguments} (JSON string)
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
         */
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)
          const execTraceId = `exec-${toolCall.id}`

          const execDone = trace(execTraceId, `Executing ${functionName}()`, { function: functionName, arguments: functionArgs })

          // Execute the function based on its name
          let result
          if (functionName === 'calculate_tip') {
            console.log('Executing calculate_tip with args:', functionArgs)
            result = calculateTip(functionArgs.bill_amount, functionArgs.tip_percentage)
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
         * The model will use the function results to generate a final text response
         */
        const secondDone = trace('second-request', 'Sending function results to model', { messageCount: chatMessages.length })

        completion = await client.chat.completions.create({
          model: MODEL,
          tools,
          messages: chatMessages,
        })

        secondDone('Final response received', completion.choices)

        // A second round of tool calls is possible in principle; not handled here to keep the lesson focused.
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
