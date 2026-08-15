import { useState } from 'react'
import type { ReactNode } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Message, TraceStep } from '@/types/chat'

interface InspectorPanelsProps {
  latestAssistantMessage: Message | undefined
  isLoading?: boolean
  traceSteps?: TraceStep[]
}

/** Small pulsing dot for in-progress steps */
function Spinner() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
    </span>
  )
}

/** Checkmark icon for completed steps */
function Check() {
  return (
    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-green-600 text-white text-[10px] font-bold">
      ✓
    </span>
  )
}

/** Error icon for failed steps */
function ErrorDot() {
  return (
    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[10px] font-bold">
      ✗
    </span>
  )
}

const STATUS_ICON: Record<TraceStep['status'], () => ReactNode> = {
  'in-progress': Spinner,
  completed: Check,
  error: ErrorDot,
}

export function InspectorPanels({
  latestAssistantMessage,
  isLoading = false,
  traceSteps = [],
}: InspectorPanelsProps) {
  const [toolTraceOpen, setToolTraceOpen] = useState(true)
  
  const responseOutput =
    latestAssistantMessage?.responseOutput ??
    latestAssistantMessage?.rawResponse?.output ??
    null

  const hasLiveTrace = traceSteps.length > 0

  // ---- Build content ----
  let content

  if (hasLiveTrace) {
    // Live trace timeline — shows steps as they arrive
    content = (
      <div className="space-y-4">
        {traceSteps.map((step) => {
          const Icon = STATUS_ICON[step.status]
          return (
            <section key={step.id} className="space-y-2 min-w-0">
              {/* Step header with status indicator */}
              <div className="flex items-center gap-2">
                <Icon />
                <h4 className="text-base font-semibold text-slate-200 text-left">
                  {step.label}
                </h4>
                <span className="ml-auto text-xs text-slate-500 font-mono tabular-nums">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Collapsible data payload */}
              {step.data != null && (
                <pre className="text-sm font-mono whitespace-pre-wrap break-all text-left bg-slate-900 text-slate-100 p-3 rounded border border-slate-600 overflow-x-auto min-w-0">
{JSON.stringify(step.data, null, 2)}
                </pre>
              )}
            </section>
          )
        })}

        {/* Show a waiting indicator when the request is still in flight */}
        {isLoading && traceSteps[traceSteps.length - 1]?.status === 'completed' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <span>Waiting…</span>
          </div>
        )}
      </div>
    )
  } else if (isLoading) {
    content = <p className="text-sm text-muted-foreground text-left">Processing request...</p>
  } else if (responseOutput) {
    // Fallback for lessons that don't use the live trace (e.g. baseline)
    content = (
      <section className="space-y-2 min-w-0">
        <h4 className="text-base font-semibold text-slate-200 text-left">response.output</h4>
        <pre className="text-sm font-mono whitespace-pre-wrap break-all text-left bg-slate-900 text-slate-100 p-4 rounded border border-slate-600 overflow-x-auto min-w-0">
          {JSON.stringify(responseOutput, null, 2)}
        </pre>
      </section>
    )
  } else {
    content = <p className="text-sm text-muted-foreground text-left">[no data]</p>
  }

  return (
    <Card className="dark overflow-hidden flex flex-col border-0 rounded-none flex-1 min-h-0">
      <Collapsible open={toolTraceOpen} onOpenChange={setToolTraceOpen} className="flex flex-col min-h-0 flex-1">
        <CardHeader className="p-4 pb-3 border-b flex-shrink-0">
          <CollapsibleTrigger asChild>
            <button className="w-full text-left hover:opacity-70 transition-opacity">
              <CardTitle className="text-2xl font-bold">API TRACE</CardTitle>
              <p className="text-sm text-muted-foreground">
                The latest assistant turn with full tool/function arguments and outputs.
              </p>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent className="flex flex-col min-h-0 h-0 flex-1">
          <ScrollArea className="flex-1 h-full w-full">
            <div className="p-4 space-y-4 min-w-0 overflow-hidden max-w-full">
              {content}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
