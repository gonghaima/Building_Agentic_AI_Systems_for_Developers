import { useState, useCallback } from 'react'
import type { TraceStep } from '@/types/chat'

/**
 * Lightweight trace helper used by every lesson page.
 *
 * - `pushTrace(step)` — low-level upsert by `id`
 * - `trace(id, label, data?)` — marks a step in-progress and returns
 *    a `done(label?, data?)` callback that completes it
 * - `clearTrace()` — resets all steps
 */
export function useTrace() {
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([])

  const pushTrace = useCallback(
    (step: TraceStep) =>
      setTraceSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === step.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = step
          return next
        }
        return [...prev, step]
      }),
    []
  )

  /** Mark a step as in-progress; returns a callback to complete it. */
  const trace = useCallback(
    (id: string, label: string, data?: unknown) => {
      pushTrace({ id, label, status: 'in-progress', timestamp: Date.now(), data })
      return (completedLabel?: string, completedData?: unknown) =>
        pushTrace({
          id,
          label: completedLabel ?? label,
          status: 'completed',
          timestamp: Date.now(),
          data: completedData,
        })
    },
    [pushTrace]
  )

  const clearTrace = useCallback(() => setTraceSteps([]), [])

  return { traceSteps, trace, pushTrace, clearTrace }
}
