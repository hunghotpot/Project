import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/*
 * Figma: surface fill + 1px slate-200 border, radius 12.
 * Heights: sm 40 (modal tables) · default 48 (checkout/modal) · lg 56 (login).
 * "white" = white fill + stronger border (coupon input, qty cells).
 */
const inputVariants = cva(
  "w-full min-w-0 rounded-xl border px-4 text-label text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-bold file:text-foreground placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 read-only:bg-secondary",
  {
    variants: {
      variant: {
        default: "border-input bg-surface",
        white: "border-border-strong bg-white",
      },
      size: {
        sm: "h-10",
        default: "h-12",
        lg: "h-14 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Input({
  className,
  type,
  variant,
  size,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
