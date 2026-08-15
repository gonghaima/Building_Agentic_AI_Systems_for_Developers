import { useEffect, useRef } from 'react'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatInput } from '@/components/ChatInput'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Message } from '@/types/chat'

interface ChatAreaProps {
  messages: Message[]
  isLoading: boolean
  onSend: (input: string) => void
}

export function ChatArea({ messages, isLoading, onSend }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full w-full">
          <div className="space-y-4 p-4 pr-6">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No messages yet. Start a conversation!
              </div>
            ) : (
              messages.map((message, index) => {
                // Determine if any tools were used: function calls, built-in tools, or MCP calls
                const usedTools = message.functionCall ||
                  (Array.isArray(message.responseOutput) &&
                    message.responseOutput.some((item: { type: string }) =>
                      item.type === 'web_search_call' || item.type === 'function_call' ||
                      item.type === 'mcp_call' || item.type === 'mcp_list_tools'
                    ))

                return (
                  <div key={index}>
                    <ChatMessage message={message.content === '' ? { ...message, content: '…' } : message} />
                    {message.role === 'assistant' && !usedTools && message.rawResponse && (
                      <div className="text-xs text-muted-foreground mt-1">
                        (No tools were used for this answer.)
                      </div>
                    )}
                  </div>
                )
              })
            )}
            {isLoading && (
              <div className="text-center text-muted-foreground text-sm">
                Generating response...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <ChatInput onSend={onSend} isLoading={isLoading} />
      </div>
    </div>
  )
}
