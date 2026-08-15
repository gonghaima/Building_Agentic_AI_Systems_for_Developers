import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, WrenchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunctionCall } from '@/types/chat'

interface FunctionCallStatusProps {
  functionCall: FunctionCall
}

export function FunctionCallStatus({ functionCall }: FunctionCallStatusProps) {
  const [isOpen, setIsOpen] = useState(false)

  const statusColors = {
    executing: 'bg-blue-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  }

  const statusLabels = {
    executing: 'Executing...',
    completed: 'Completed ✓',
    error: 'Error',
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-2">
      <div className={cn('border rounded-lg p-3', functionCall.status === 'error' && 'border-red-300')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80">
          <div className="flex items-center gap-2">
            <span className="text-lg"><WrenchIcon size={20} color="#000" /></span>
            <span className="font-semibold">Tool Called: {functionCall.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-white', statusColors[functionCall.status])}>
              {statusLabels[functionCall.status]}
            </Badge>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1">Parameters:</h4>
            <pre className="text-sm text-left bg-muted p-2 rounded overflow-x-auto max-w-full">
              {JSON.stringify(JSON.parse(functionCall.arguments), null, 2)}
            </pre>
          </div>

          {functionCall.response !== undefined && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Response:</h4>
              <pre className="text-sm text-left bg-muted p-2 rounded overflow-x-auto max-w-full">
                {typeof functionCall.response === 'string'
                  ? functionCall.response
                  : JSON.stringify(functionCall.response, null, 2)}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
