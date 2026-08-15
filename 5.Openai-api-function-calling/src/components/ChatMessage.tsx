import { cn } from '@/lib/utils'
import type { Message } from '@/types/chat'
import ReactMarkdown from 'react-markdown'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex flex-col w-full', isUser ? 'items-end' : 'items-start')}>
      <div className={cn('max-w-[80%] text-lg p-4 rounded-lg', isUser ? 'bg-gray-200 text-right' : 'bg-blue-100 text-left')}>
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />
                ),
                p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
