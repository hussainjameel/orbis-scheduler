import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-sm border border-border-strong bg-surface-2 px-2.5 py-2 text-base text-text-primary transition-colors outline-none placeholder:text-text-muted focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-1 disabled:text-text-disabled aria-invalid:border-rejected-text aria-invalid:ring-2 aria-invalid:ring-rejected-text/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
