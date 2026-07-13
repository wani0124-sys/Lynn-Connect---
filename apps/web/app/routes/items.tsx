// 실제로는 loader에서 실제 API를 호출하고 응답을 zod로 검증한다. demo 파라미터는 상태 시연용이다.
import { useState } from "react"
import { Link, useLoaderData, useSearchParams } from "react-router"
import type { LoaderFunctionArgs } from "react-router"
import { Package, Plus, Search } from "lucide-react"
import { cn } from "~/shared/lib/cn"
import { formatCurrency, formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { EmptyState } from "~/shared/ui/empty-state"
import { ErrorState } from "~/shared/ui/error-state"
import { Input } from "~/shared/ui/input"
import { PageHeader } from "~/shared/ui/page-header"
import { Select } from "~/shared/ui/select"
import { Skeleton } from "~/shared/ui/skeleton"
import { TBody, TD, TH, THead, TR, Table } from "~/shared/ui/table"
import { mockItems } from "~/entities/item/model/item.mock"
import type { ItemStatus } from "~/entities/item/model/item.types"
import { ItemStatusBadge } from "~/entities/item/ui/item-status-badge"

export async function loader(_args: LoaderFunctionArgs) {
  return { items: mockItems }
}

const DEMO_SEGMENTS = [
  { value: "normal", label: "정상" },
  { value: "loading", label: "로딩" },
  { value: "empty", label: "빈 상태" },
  { value: "error", label: "오류" },
]

type StatusFilter = "all" | ItemStatus

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "활성" },
  { value: "pending", label: "대기" },
  { value: "archived", label: "보관" },
]

export default function ItemsRoute() {
  const { items } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const demo = searchParams.get("demo") ?? "normal"
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")

  const filtered = items.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(q.trim().toLowerCase())
    const matchesStatus = status === "all" || item.status === status
    return matchesQuery && matchesStatus
  })

  function setDemo(value: string) {
    setSearchParams((prev) => {
      prev.set("demo", value)
      return prev
    })
  }

  const count = demo === "empty" ? 0 : demo === "normal" ? filtered.length : items.length

  function renderBody() {
    if (demo === "loading") {
      return (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      )
    }

    if (demo === "error") {
      return (
        <ErrorState
          title="목록을 불러오지 못했습니다"
          description="네트워크 오류로 항목을 표시하지 못했습니다. 다시 시도해 주세요."
          onRetry={() => setDemo("normal")}
        />
      )
    }

    if (demo === "empty") {
      return (
        <EmptyState
          icon={<Package className="size-6" aria-hidden />}
          title="등록된 항목이 없습니다."
          description="새 항목을 추가해 시작하세요."
          action={
            <Button>
              <Plus />
              새 항목
            </Button>
          }
        />
      )
    }

    if (filtered.length === 0) {
      return (
        <EmptyState
          title="검색 결과가 없습니다."
          description="검색어나 필터를 변경해 보세요."
        />
      )
    }

    return (
      <Table>
        <THead>
          <TR>
            <TH>항목 ID</TH>
            <TH>이름</TH>
            <TH>상태</TH>
            <TH>담당자</TH>
            <TH className="text-right">금액</TH>
            <TH>수정일</TH>
            <TH className="text-right">
              <span className="sr-only">작업</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {filtered.map((item) => (
            <TR key={item.id}>
              <TD className="text-xs text-muted-foreground">{item.id}</TD>
              <TD>
                <Link to={`/items/${item.id}`} className="font-medium hover:underline">
                  {item.name}
                </Link>
              </TD>
              <TD>
                <ItemStatusBadge status={item.status} />
              </TD>
              <TD>{item.owner}</TD>
              <TD className="text-right tabular-nums">{formatCurrency(item.amount)}</TD>
              <TD>{formatDate(item.updatedAt)}</TD>
              <TD className="text-right">
                <Link to={`/items/${item.id}`}>
                  <Button variant="ghost" size="sm">
                    보기
                  </Button>
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="항목 관리"
        description="등록된 항목을 검색·필터하고 상세로 이동합니다."
        actions={
          <Button>
            <Plus />
            새 항목
          </Button>
        }
      />

      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
        {DEMO_SEGMENTS.map((segment) => {
          const active = demo === segment.value
          return (
            <button
              key={segment.value}
              type="button"
              onClick={() => setDemo(segment.value)}
              aria-pressed={active}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {segment.label}
            </button>
          )
        })}
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="이름으로 검색"
              className="pl-9"
              aria-label="항목 이름 검색"
            />
          </div>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            aria-label="상태 필터"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4">{renderBody()}</div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">총 {count}건</p>
          {/* 실제로는 URL search params의 page로 페이지네이션을 관리한다. */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              이전
            </Button>
            <Button variant="outline" size="sm" disabled>
              다음
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
