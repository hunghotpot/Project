"use client"

import * as React from "react"
import { cn } from "cn"

// Figma: 13px bold ink; required marker "*" in brand colour (<span className="text-destructive">*</span>)
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 text-label leading-none font-bold text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
