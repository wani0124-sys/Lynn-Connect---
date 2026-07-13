import type { ReactNode } from "react"
import { LayoutTemplate } from "lucide-react"
import { cn } from "~/shared/lib/cn"

export interface PlaceholderProps {
  title: string
  description?: string
  icon?: ReactNode
  className?: string
}

// 스캐폴드 전용 안내 블록. "여기에 무엇을 배치할지" 알려준다. 실제 구현 시 실제 위젯으로 교체한다.
export function Placeholder({ title, description, icon, className }: PlaceholderProps) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center",
        className,
      )}
    >
      <span className="text-muted-foreground">
        {icon ?? <LayoutTemplate className="size-6" aria-hidden />}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-md text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}
