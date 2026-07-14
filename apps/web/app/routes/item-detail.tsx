import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router"
import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { getMockItem } from "~/entities/item/model/item.mock"
import { ItemStatusBadge } from "~/entities/item/ui/item-status-badge"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"
import { Placeholder } from "~/shared/ui/placeholder"
import { formatCurrency, formatDateTime } from "~/shared/lib/format"

export async function loader({ params }: LoaderFunctionArgs) {
  const item = getMockItem(params.itemId ?? "")
  return { item: item ?? null }
}

export default function ItemDetailRoute() {
  const { item } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await new Promise((r) => setTimeout(r, 700))
    navigate("/items")
  }

  if (!item) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title="항목을 찾을 수 없습니다."
          description="삭제되었거나 잘못된 주소입니다."
          action={
            <Link to="/items">
              <Button variant="outline">목록으로</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/items" className="text-sm text-muted-foreground hover:text-foreground">
        <span className="font-semibold text-foreground">[목록]</span> 항목 관리
      </Link>

      <div className="space-y-3">
        <PageHeader
          title={item.name}
          description={item.id}
          actions={
            <>
              <Button variant="outline">
                <Pencil aria-hidden />
                편집
              </Button>
              <Button variant="danger" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                삭제
              </Button>
            </>
          }
        />
        <ItemStatusBadge status={item.status} />
      </div>

      {confirming ? (
        <ConfirmPanel
          title="이 항목을 삭제할까요?"
          description="삭제하면 되돌릴 수 없습니다. 연결된 데이터도 함께 사라질 수 있습니다."
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
          pending={deleting}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">담당자</dt>
                <dd className="text-sm font-medium">{item.owner}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">상태</dt>
                <dd className="text-sm font-medium">
                  <ItemStatusBadge status={item.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">금액</dt>
                <dd className="text-sm font-medium tabular-nums">{formatCurrency(item.amount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">최근 수정</dt>
                <dd className="text-sm font-medium">{formatDateTime(item.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>하위 섹션</CardTitle>
          </CardHeader>
          <CardContent>
            <Placeholder
              title="상세 하위 영역"
              description="이력, 첨부파일, 관련 항목, 활동 로그 등을 여기에 배치하세요."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
