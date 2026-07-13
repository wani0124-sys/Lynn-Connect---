import type { ReactNode } from "react"
import { cn } from "~/shared/lib/cn"
import { Card } from "~/shared/ui/card"

export interface StatCardProps {
  label: string
  value: string
  icon?: ReactNode
  delta?: { value: string; trend: "up" | "down" | "flat" }
  className?: string
}

export function StatCard({ label, value, icon, delta, className }: StatCardProps) {
  const trendColor =
    delta?.trend === "up"
      ? "text-success"
      : delta?.trend === "down"
        ? "text-danger"
        : "text-muted-foreground"

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {delta ? <p className={cn("mt-1 text-xs", trendColor)}>{delta.value}</p> : null}
    </Card>
  )
}
