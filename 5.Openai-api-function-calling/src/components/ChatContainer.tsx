import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Message } from '@/types/chat'

interface ChatContainerProps {
  messages: Message[]
  onSend: (message: string) => void
  isLoading?: boolean
  lessonTitle?: string
  apiType?: 'responses' | 'completions'
}

export function ChatContainer({
  messages,
  onSend,
  isLoading = false,
  lessonTitle = 'Chat',
  apiType,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-4xl font-bold">{lessonTitle}</h1>
        {apiType && (
          <p className="text-base text-muted-foreground">
            Using {apiType === 'responses' ? 'Responses API' : 'Completions API'}
          </p>
        )}
      </div>

      {/* Messages */}
      <Card className="flex-1 mb-4 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4 px-6">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No messages yet. Start a conversation!
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))
            )}
            {isLoading && (
              <div className="text-center text-muted-foreground text-sm">
                Generating response...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>

      {/* Input */}
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  )
}
