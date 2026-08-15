import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-6 border-gray-300 dark:border-gray-300 placeholder:text-muted-foreground focus-visible:border-gray-300 focus-visible:ring-1 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-xl bg-transparent px-4 py-4 text-lg transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-lg",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
