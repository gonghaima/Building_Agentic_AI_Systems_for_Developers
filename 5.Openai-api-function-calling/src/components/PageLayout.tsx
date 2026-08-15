import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCcw } from 'lucide-react'

interface PageLayoutProps {
  title: string
  subtitle?: string
  chatContent: ReactNode
  inspectorContent: ReactNode
  onClear?: () => void
}

export function PageLayout({
  title,
  subtitle,
  chatContent,
  inspectorContent,
  onClear,
}: PageLayoutProps) {
  return (
    <div className="grid grid-cols-2 gap-4 h-[calc(100vh-4rem)] m-4" style={{ backgroundColor: 'oklch(0.208 0.042 265.755)', borderRadius: '2rem' }}>
      {/* Left Column: Chat Interface */}
      <Card className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200">
          <div className="p-4">
            <h1 className="text-2xl font-bold text-left">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {onClear && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="mr-4"
              title="Clear chat history"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Chat Content Area */}
        <div className="flex-1 overflow-hidden">{chatContent}</div>
      </Card>

      {/* Right Column: Inspector Panels */}
      <div className="min-h-0 min-w-0 flex flex-col overflow-hidden" style={{ borderRadius: '1.4rem' }}>{inspectorContent}</div>
    </div>
  )
}
