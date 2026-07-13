// 실제로는 fetchDashboard를 실제 API 호출로 교체하고, 응답 스키마를 zod로 검증한다.
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { Clock, Package, Users, Wallet } from "lucide-react"
import { MEMBER_ROLE_LABEL } from "~/entities/member/model/member"
import { requireUser } from "~/features/auth/model/session.server"
import { mockItems } from "~/entities/item/model/item.mock"
import { ItemStatusBadge } from "~/entities/item/ui/item-status-badge"
import { formatCurrency, formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ErrorState } from "~/shared/ui/error-state"
import { PageHeader } from "~/shared/ui/page-header"
import { Placeholder } from "~/shared/ui/placeholder"
import { Skeleton } from "~/shared/ui/skeleton"
import { StatCard } from "~/shared/ui/stat-card"
import { TBody, THead, TD, TH, TR, Table } from "~/shared/ui/table"

async function fetchDashboard() {
  await new Promise((r) => setTimeout(r, 600))
  return {
    stats: [
      { label: "전체 항목", value: "1,284", delta: "지난주 대비 +4.2%", trend: "up" },
      { label: "대기 중", value: "37", delta: "어제 대비 -3건", trend: "down" },
      { label: "활성 구성원", value: "52", delta: "변동 없음", trend: "flat" },
      { label: "이번 달 처리액", value: formatCurrency(84200000), delta: "목표의 68%", trend: "up" },
    ],
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  return { user }
}

function DashboardBanner({ user }: { user: any }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = time.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const timeStr = time.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })

  return (
    <div className="rounded-lg bg-primary px-6 py-4 text-primary-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-primary-foreground/30 bg-primary-foreground/10 text-lg font-bold">
            {user.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs opacity-90">{MEMBER_ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{dateStr}</p>
          <p className="text-lg font-bold">{timeStr}</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardRoute() {
  const { user } = useLoaderData<typeof loader>()
  const { isPending, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  })

  return (
    <div className="space-y-6">
      <DashboardBanner user={user} />

      <PageHeader
        title="대시보드"
        description={`${user.name}님, 오늘의 주요 지표와 최근 활동입니다.`}
        actions={<Button variant="outline">기간: 최근 7일</Button>}
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isPending ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <StatCard
                label="전체 항목"
                value="1,284"
                icon={<Package />}
                delta={{ value: "지난주 대비 +4.2%", trend: "up" }}
              />
              <StatCard
                label="대기 중"
                value="37"
                icon={<Clock />}
                delta={{ value: "어제 대비 -3건", trend: "down" }}
              />
              <StatCard
                label="활성 구성원"
                value="52"
                icon={<Users />}
                delta={{ value: "변동 없음", trend: "flat" }}
              />
              <StatCard
                label="이번 달 처리액"
                value={formatCurrency(84200000)}
                icon={<Wallet />}
                delta={{ value: "목표의 68%", trend: "up" }}
              />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>최근 활동</CardTitle>
            <Link to="/items" className="text-sm font-medium text-primary hover:underline">
              전체 보기
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>항목</TH>
                  <TH>상태</TH>
                  <TH>담당자</TH>
                  <TH>수정일</TH>
                </TR>
              </THead>
              <TBody>
                {mockItems.slice(0, 5).map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <Link to={`/items/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </TD>
                    <TD>
                      <ItemStatusBadge status={item.status} />
                    </TD>
                    <TD>{item.owner}</TD>
                    <TD>{formatDate(item.updatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>요약 위젯</CardTitle>
          </CardHeader>
          <CardContent>
            <Placeholder
              title="차트 / 요약 영역"
              description="여기에 추세 차트, 승인 대기 목록, 알림 요약 등을 배치하세요."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
