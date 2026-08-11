import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-sm border border-border-strong bg-surface-2 px-2.5 py-1 text-base text-text-primary transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary placeholder:text-text-muted focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-1 disabled:text-text-disabled aria-invalid:border-rejected-text aria-invalid:ring-2 aria-invalid:ring-rejected-text/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
