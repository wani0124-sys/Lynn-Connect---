import { useState } from "react"
import { Link, data, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { Settings2 } from "lucide-react"
import { isHeadquarters } from "~/entities/member/model/member"
import { InspectionResultBadge } from "~/entities/site/ui/inspection-result-badge"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import {
  createSite,
  deleteSite,
  listSitesWithLatestInspection,
  renameSite,
  reorderSites,
} from "~/features/sites/model/sites.repository.server"
import { validateSiteName } from "~/features/sites/model/sites.schema"
import { SiteManageModal } from "~/features/sites/ui/site-manage-modal"
import { formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  try {
    const sites = await listSitesWithLatestInspection()
    return { sites, canManage: isHeadquarters(user.role), migrationPending: false }
  } catch (error) {
    console.error("현장 목록을 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
    return { sites: [], canManage: isHeadquarters(user.role), migrationPending: true }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHeadquarters(request)
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "site.create": {
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSiteName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await createSite(name, String(form.get("address") ?? "").trim() || null)
        return { ok: true }
      }
      case "site.rename": {
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSiteName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await renameSite(Number(form.get("id")), name, String(form.get("address") ?? "").trim() || null)
        return { ok: true }
      }
      case "site.delete": {
        await deleteSite(Number(form.get("id")))
        return { ok: true }
      }
      case "site.reorder": {
        await reorderSites(JSON.parse(String(form.get("items") ?? "[]")))
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

export default function SitesRoute() {
  const { sites, canManage, migrationPending } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()
  const [manageOpen, setManageOpen] = useState(false)

  const actionError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null
  const sorted = [...sites].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-4">
      <PageHeader
        title="현장 점검"
        description="현장이 받은 대외 점검(관공서·감리단·발주처 등) 이력을 관리합니다"
        actions={
          canManage && !migrationPending ? (
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Settings2 className="size-4" aria-hidden />
              현장 관리
            </Button>
          ) : null
        }
      />

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      {migrationPending ? (
        <Card className="p-5">
          <EmptyState
            title="아직 DB 준비가 안 됐습니다"
            description="supabase/migrations/20260713090000_site_inspections.sql을 Supabase SQL Editor에서 실행한 뒤 새로고침하세요."
          />
        </Card>
      ) : sorted.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="등록된 현장이 없습니다" description="현장 관리에서 현장을 먼저 추가하세요." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((site) => (
            <Link key={site.id} to={`/sites/${site.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-primary/40">
                <p className="truncate text-base font-semibold text-foreground">{site.name}</p>
                {site.address ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{site.address}</p> : null}

                <div className="mt-4 border-t border-border pt-3">
                  {site.latestInspection ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">최근 점검</span>
                        <InspectionResultBadge result={site.latestInspection.result} />
                      </div>
                      <p className="truncate text-sm text-foreground">{site.latestInspection.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(site.latestInspection.inspectedAt)}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">아직 점검 기록이 없습니다.</p>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">총 {site.inspectionCount}건 점검</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canManage ? (
        <SiteManageModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          sites={sites}
          pending={fetcher.state !== "idle"}
          onCreate={(name, address) => fetcher.submit({ intent: "site.create", name, address }, { method: "post" })}
          onRename={(id, name, address) =>
            fetcher.submit({ intent: "site.rename", id: String(id), name, address }, { method: "post" })
          }
          onDelete={(id) => fetcher.submit({ intent: "site.delete", id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) fetcher.submit({ intent: "site.reorder", items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}
    </div>
  )
}
