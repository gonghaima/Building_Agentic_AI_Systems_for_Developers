import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SendHorizontal } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, isLoading = false, placeholder = 'Type your message...' }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [isLoading])

  function handleSend() {
    if (input.trim() && !isLoading) {
      onSend(input.trim())
      setInput('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits, Shift+Enter creates new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={3}
          className="resize-none text-base"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send,{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Shift</kbd> +{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> for new line
        </p>
      </div>
      <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="lg" className="self-start mt-1">
        <SendHorizontal className="h-5 w-5" />
      </Button>
    </div>
  )
}
