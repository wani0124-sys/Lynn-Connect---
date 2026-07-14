import { useState } from "react"
import { Link, data, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { FileText, Settings2 } from "lucide-react"
import { isHeadquarters } from "~/entities/member/model/member"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import {
  createSeries,
  deleteSeries,
  listSeriesWithLatestRevision,
  renameSeries,
  reorderSeries,
} from "~/features/documents/model/documents.repository.server"
import { validateSeriesName } from "~/features/documents/model/documents.schema"
import { SeriesManageModal } from "~/features/documents/ui/series-manage-modal"
import { formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  try {
    const series = await listSeriesWithLatestRevision()
    return { series, canManage: isHeadquarters(user.role), migrationPending: false }
  } catch (error) {
    console.error("문서 목록을 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
    return { series: [], canManage: isHeadquarters(user.role), migrationPending: true }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHeadquarters(request)
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "series.create": {
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSeriesName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await createSeries(name, String(form.get("description") ?? "").trim() || null)
        return { ok: true }
      }
      case "series.rename": {
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSeriesName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await renameSeries(Number(form.get("id")), name, String(form.get("description") ?? "").trim() || null)
        return { ok: true }
      }
      case "series.delete": {
        await deleteSeries(Number(form.get("id")))
        return { ok: true }
      }
      case "series.reorder": {
        await reorderSeries(JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      default:
        return data({ error: "알 수 없는 요청입니다." }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
    return data({ error: message }, { status: 400 })
  }
}

export default function DocumentsRoute() {
  const { series, canManage, migrationPending } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()
  const [manageOpen, setManageOpen] = useState(false)

  const actionError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null
  const sorted = [...series].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-4">
      <PageHeader
        title="문서 관리"
        description="현장에 안내하는 반복 개정 문서(체크리스트 등)를 리비전별로 관리하고, 이전 버전과의 변경사항을 비교합니다"
        actions={
          canManage && !migrationPending ? (
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Settings2 className="size-4" aria-hidden />
              문서 관리
            </Button>
          ) : null
        }
      />

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      {migrationPending ? (
        <Card className="p-5">
          <EmptyState
            title="아직 DB 준비가 안 됐습니다"
            description="supabase/migrations/20260713100000_document_revisions.sql을 Supabase SQL Editor에서 실행한 뒤 새로고침하세요."
          />
        </Card>
      ) : sorted.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="등록된 문서가 없습니다" description="문서 관리에서 문서를 먼저 추가하세요." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => (
            <Link key={item.id} to={`/documents/${item.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start gap-2">
                  <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
                    {item.description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p> : null}
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  {item.latestRevision ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{item.latestRevision.revisionLabel}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.latestRevision.createdAt)}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">아직 업로드된 리비전이 없습니다.</p>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">총 {item.revisionCount}개 리비전</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canManage ? (
        <SeriesManageModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          series={series}
          pending={fetcher.state !== "idle"}
          onCreate={(name, description) => fetcher.submit({ intent: "series.create", name, description }, { method: "post" })}
          onRename={(id, name, description) =>
            fetcher.submit({ intent: "series.rename", id: String(id), name, description }, { method: "post" })
          }
          onDelete={(id) => fetcher.submit({ intent: "series.delete", id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) fetcher.submit({ intent: "series.reorder", items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}
    </div>
  )
}
