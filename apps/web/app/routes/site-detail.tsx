import { useState } from "react"
import { Link, data, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { AlertTriangle, Download, Paperclip, Plus, Trash2 } from "lucide-react"
import { canWriteSite } from "~/entities/member/model/member"
import { InspectionResultBadge } from "~/entities/site/ui/inspection-result-badge"
import { requireSiteWriteAccess, requireUser } from "~/features/auth/model/session.server"
import {
  createInspection,
  deleteInspection,
  getInspectionAttachmentDownloadUrl,
  getSiteById,
  listInspections,
} from "~/features/sites/model/sites.repository.server"
import {
  validateInspectedAt,
  validateInspectionResult,
  validateInspectionTitle,
  validateInspectorOrg,
} from "~/features/sites/model/sites.schema"
import { InspectionFormModal } from "~/features/sites/ui/inspection-form-modal"
import { formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const siteId = Number(params.siteId ?? "")

  try {
    const [site, inspections] = await Promise.all([getSiteById(siteId), listInspections(siteId)])

    let attachmentUrls: Record<string, string> = {}
    const allAttachments = inspections.flatMap((insp) => insp.attachments)
    if (allAttachments.length > 0) {
      const entries = await Promise.all(
        allAttachments.map(async (att) => [att.id, (await getInspectionAttachmentDownloadUrl(att.id))?.url ?? null] as const),
      )
      attachmentUrls = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null))
    }

    return { site, inspections, attachmentUrls, canWrite: site ? canWriteSite(user, site.id) : false, migrationPending: false }
  } catch (error) {
    console.error("현장 정보를 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
    return { site: null, inspections: [], attachmentUrls: {}, canWrite: false, migrationPending: true }
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const siteId = Number(params.siteId ?? "")
  const user = await requireSiteWriteAccess(request, siteId)
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "inspection.create": {
        const title = String(form.get("title") ?? "").trim()
        const inspectorOrg = String(form.get("inspectorOrg") ?? "").trim()
        const inspectedAt = String(form.get("inspectedAt") ?? "").trim()
        const result = String(form.get("result") ?? "").trim()

        const validationError =
          validateInspectionTitle(title) ||
          validateInspectorOrg(inspectorOrg) ||
          validateInspectedAt(inspectedAt) ||
          validateInspectionResult(result)
        if (validationError) return data({ error: validationError }, { status: 400 })

        const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
        const attachments = await Promise.all(
          files.map(async (file) => ({
            filename: file.name,
            mimeType: file.type || null,
            content: Buffer.from(await file.arrayBuffer()),
          })),
        )

        await createInspection({
          siteId,
          title,
          inspectorOrg,
          inspectedAt,
          result,
          nextInspectionAt: String(form.get("nextInspectionAt") ?? "").trim() || null,
          requiresReinspection: form.get("requiresReinspection") === "true",
          note: String(form.get("note") ?? "").trim() || null,
          createdBy: user.id,
          attachments,
        })
        return { ok: true }
      }
      case "inspection.delete": {
        await deleteInspection(String(form.get("id") ?? ""))
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

export default function SiteDetailRoute() {
  const { site, inspections, attachmentUrls, canWrite, migrationPending } = useLoaderData<typeof loader>()
  const actionFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const [formOpen, setFormOpen] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showAllInspections, setShowAllInspections] = useState(false)

  if (!site) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title={migrationPending ? "아직 DB 준비가 안 됐습니다" : "현장을 찾을 수 없습니다."}
          description={
            migrationPending
              ? "supabase/migrations/20260713090000_site_inspections.sql을 Supabase SQL Editor에서 실행한 뒤 새로고침하세요."
              : "삭제되었거나 잘못된 주소입니다."
          }
          action={
            <Link to="/sites">
              <Button variant="outline">목록으로</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const actionError = actionFetcher.data && "error" in actionFetcher.data ? actionFetcher.data.error : null
  const visibleInspections = showAllInspections ? inspections : inspections.slice(0, 1)

  return (
    <div className="space-y-6">
      <Link to="/sites" className="text-sm text-muted-foreground hover:text-foreground">
        ← 현장 점검
      </Link>

      <PageHeader
        title={site.name}
        description={`${site.address ?? "주소 미등록"} · 총 ${inspections.length}건 점검`}
        actions={
          canWrite ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              점검 기록 추가
            </Button>
          ) : null
        }
      />

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{showAllInspections ? "점검 이력" : "최신 점검"}</CardTitle>
          {inspections.length > 1 ? (
            <button
              type="button"
              onClick={() => setShowAllInspections((prev) => !prev)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {showAllInspections ? "최신 점검만 보기" : `전체 이력 보기 (${inspections.length}건)`}
            </button>
          ) : null}
        </CardHeader>
        <CardContent>
          {inspections.length === 0 ? (
            <EmptyState title="점검 기록이 없습니다" description="이 현장이 받은 대외 점검 기록을 추가해 보세요." />
          ) : (
            <ul className="divide-y divide-border">
              {visibleInspections.map((insp) => (
                <li key={insp.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <InspectionResultBadge result={insp.result} />
                        {insp.requiresReinspection ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                            <AlertTriangle className="size-3.5" aria-hidden />
                            재점검 필요
                          </span>
                        ) : null}
                      </div>
                      <p className="font-medium text-foreground">{insp.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {insp.inspectorOrg} · {formatDate(insp.inspectedAt)}
                        {insp.nextInspectionAt ? ` · 다음 점검 예정일 ${formatDate(insp.nextInspectionAt)}` : ""}
                      </p>
                      {insp.note ? <p className="whitespace-pre-wrap text-sm text-foreground">{insp.note}</p> : null}
                      {insp.attachments.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {insp.attachments.map((att) => (
                            <li key={att.id} className="flex items-center gap-1.5 text-sm">
                              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              {attachmentUrls[att.id] ? (
                                <a
                                  href={attachmentUrls[att.id]}
                                  download={att.filename}
                                  className="inline-flex items-center gap-1 truncate text-primary hover:underline"
                                >
                                  {att.filename}
                                  <Download className="size-3.5 shrink-0" aria-hidden />
                                </a>
                              ) : (
                                <span className="truncate text-muted-foreground">{att.filename}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="삭제"
                        onClick={() => setConfirmingDeleteId(insp.id)}
                      >
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    ) : null}
                  </div>

                  {confirmingDeleteId === insp.id ? (
                    <div className="mt-3">
                      <ConfirmPanel
                        title="이 점검 기록을 삭제할까요?"
                        description="첨부파일을 포함해 함께 삭제되며 되돌릴 수 없습니다."
                        onConfirm={() => {
                          deleteFetcher.submit({ intent: "inspection.delete", id: insp.id }, { method: "post" })
                          setConfirmingDeleteId(null)
                        }}
                        onCancel={() => setConfirmingDeleteId(null)}
                        pending={deleteFetcher.state !== "idle"}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canWrite ? <InspectionFormModal open={formOpen} onClose={() => setFormOpen(false)} siteId={site.id} /> : null}
    </div>
  )
}
