import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"

export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

export function ErrorState({
  title = "문제가 발생했습니다",
  description = "잠시 후 다시 시도해 주세요.",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
      {action}
    </div>
  )
}
