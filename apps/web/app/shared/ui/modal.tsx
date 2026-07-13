import type { ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className={cn("relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-lg", className)}>
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-border p-5">{footer}</div> : null}
      </div>
    </div>
  )
}
