import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"

export interface ConfirmPanelProps {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  pending?: boolean
  className?: string
}

// 파괴적 작업(삭제/초기화) 확인용 인라인 패널. 무엇이 바뀌는지, 되돌릴 수 있는지 명시한다.
export function ConfirmPanel({
  title,
  description,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
  pending,
  className,
}: ConfirmPanelProps) {
  return (
    <div className={cn("rounded-lg border border-danger/30 bg-danger/5 p-4", className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={pending}>
          {pending ? "처리 중…" : confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  )
}
