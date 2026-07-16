import type { ReactNode } from "react"
import { cn } from "~/shared/lib/cn"

export interface TabItem {
  value: string
  label: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  // "pill": 세그먼트 버튼 형태(기본, 같은 계층의 선택지). "folder": 브라우저 탭처럼 활성 탭이 카드 형태로 도드라지는 상위 카테고리 구분용.
  variant?: "pill" | "folder"
}

export function Tabs({ items, value, onChange, className, variant = "pill" }: TabsProps) {
  if (variant === "folder") {
    return (
      <div className={cn("flex flex-wrap gap-1 border-b border-border", className)}>
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={cn(
                "-mb-px rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border border-b-0 border-border bg-card text-foreground shadow-sm"
                  : "border border-b-0 border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-1 rounded-md border border-border bg-muted p-1", className)}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
