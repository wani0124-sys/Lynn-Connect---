import type { InputHTMLAttributes } from "react"
import { cn } from "~/shared/lib/cn"

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring", className)}
      {...props}
    />
  )
}
