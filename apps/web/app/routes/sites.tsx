import { useState } from "react"
import { Link, data, useFetcher, useLoaderData, useSearchParams, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { AlertTriangle, ChevronDown, ChevronUp, Download, Paperclip, Pencil, Plus, Printer, Settings2, Trash2 } from "lucide-react"
import { canWriteSite, isHeadquarters } from "~/entities/member/model/member"
import type { SiteInspection } from "~/entities/site/model/site.types"
import { InspectionReportTable } from "~/entities/site/ui/inspection-report-table"
import { InspectionResultBadge } from "~/entities/site/ui/inspection-result-badge"
import { InspectionStandardGuide } from "~/entities/site/ui/inspection-standard-guide"
import { usePageMenuTitle } from "~/entities/sidebar-menu/lib/use-page-menu-title"
import { requireHeadquarters, requireSiteWriteAccess, requireUser } from "~/features/auth/model/session.server"
import { askAboutInspections, type InspectionChatMessage } from "~/features/sites/model/inspection-ai-analysis.server"
import { parseInspectionReportPdf } from "~/features/sites/model/inspection-report.parser.server"
import {
  createInspection,
  createSite,
  deleteInspection,
  deleteSite,
  getInspectionAttachmentDownloadUrl,
  getSiteById,
  listInspections,
  listSites,
  listSitesWithLatestInspection,
  renameSite,
  reorderSites,
  updateInspection,
} from "~/features/sites/model/sites.repository.server"
import {
  validateInspectedAt,
  validateInspectionResult,
  validateInspectionTitle,
  validateInspectorOrg,
  validateSiteName,
} from "~/features/sites/model/sites.schema"
import { InspectionAiAnalysisPanel } from "~/features/sites/ui/inspection-ai-analysis-panel"
import { InspectionFormModal } from "~/features/sites/ui/inspection-form-modal"
import { SiteManageModal } from "~/features/sites/ui/site-manage-modal"
import { formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"
import { Tabs } from "~/shared/ui/tabs"

const STANDARD_TAB_VALUE = "standard"
const RESULTS_TAB_VALUE = "results"
const AI_TAB_VALUE = "ai"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const url = new URL(request.url)
  const siteIdParam = url.searchParams.get("site")
  // "site" 파라미터가 없거나 "standard"면 기준 안내 탭을 기본값으로 보여준다(현장별 이력보다 먼저).
  const isStandardTab = siteIdParam === null || siteIdParam === STANDARD_TAB_VALUE
  const isAiTab = siteIdParam === AI_TAB_VALUE
  const topTab = isStandardTab ? STANDARD_TAB_VALUE : isAiTab ? AI_TAB_VALUE : RESULTS_TAB_VALUE

  try {
    const sites = await listSitesWithLatestInspection()
    const sorted = [...sites].sort((a, b) => a.sortOrder - b.sortOrder)
    const parsedSiteId = topTab === RESULTS_TAB_VALUE && siteIdParam ? Number(siteIdParam) : NaN
    const selectedSiteId = Number.isFinite(parsedSiteId) ? parsedSiteId : null
    const selectedSite = selectedSiteId !== null ? await getSiteById(selectedSiteId) : null

    let inspections: Awaited<ReturnType<typeof listInspections>> = []
    let attachmentUrls: Record<string, string> = {}
    if (selectedSite) {
      inspections = await listInspections(selectedSite.id)
      const allAttachments = inspections.flatMap((insp) => insp.attachments)
      if (allAttachments.length > 0) {
        const entries = await Promise.all(
          allAttachments.map(async (att) => [att.id, (await getInspectionAttachmentDownloadUrl(att.id))?.url ?? null] as const),
        )
        attachmentUrls = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null))
      }
    }

    return {
      sites,
      selectedSite,
      inspections,
      attachmentUrls,
      canManage: isHeadquarters(user.role),
      canWrite: selectedSite ? canWriteSite(user, selectedSite.id) : false,
      migrationPending: false,
      topTab,
    }
  } catch (error) {
    console.error("현장 정보를 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
    return {
      sites: [],
      selectedSite: null,
      inspections: [],
      attachmentUrls: {},
      canManage: isHeadquarters(user.role),
      canWrite: false,
      migrationPending: true,
      topTab,
    }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "site.create": {
        await requireHeadquarters(request)
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSiteName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await createSite(name, String(form.get("address") ?? "").trim() || null)
        return { ok: true }
      }
      case "site.rename": {
        await requireHeadquarters(request)
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSiteName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await renameSite(Number(form.get("id")), name, String(form.get("address") ?? "").trim() || null)
        return { ok: true }
      }
      case "site.delete": {
        await requireHeadquarters(request)
        await deleteSite(Number(form.get("id")))
        return { ok: true }
      }
      case "site.reorder": {
        await requireHeadquarters(request)
        await reorderSites(JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      case "inspection.create": {
        const siteId = Number(form.get("siteId"))
        const user = await requireSiteWriteAccess(request, siteId)
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
          inspectedAtEnd: String(form.get("inspectedAtEnd") ?? "").trim() || null,
          inspectionTime: String(form.get("inspectionTime") ?? "").trim() || null,
          result,
          purpose: String(form.get("purpose") ?? "").trim() || null,
          inspectors: String(form.get("inspectors") ?? "").trim() || null,
          content: String(form.get("content") ?? "").trim() || null,
          resultDetail: String(form.get("resultDetail") ?? "").trim() || null,
          findings: String(form.get("findings") ?? "").trim() || null,
          nextInspectionAt: String(form.get("nextInspectionAt") ?? "").trim() || null,
          requiresReinspection: form.get("requiresReinspection") === "true",
          note: String(form.get("note") ?? "").trim() || null,
          createdBy: user.id,
          attachments,
        })
        return { ok: true }
      }
      case "inspection.update": {
        const id = String(form.get("id") ?? "")
        const siteId = Number(form.get("siteId"))
        const user = await requireSiteWriteAccess(request, siteId)
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
        const newAttachments = await Promise.all(
          files.map(async (file) => ({
            filename: file.name,
            mimeType: file.type || null,
            content: Buffer.from(await file.arrayBuffer()),
          })),
        )

        await updateInspection(id, {
          title,
          inspectorOrg,
          inspectedAt,
          inspectedAtEnd: String(form.get("inspectedAtEnd") ?? "").trim() || null,
          inspectionTime: String(form.get("inspectionTime") ?? "").trim() || null,
          result,
          purpose: String(form.get("purpose") ?? "").trim() || null,
          inspectors: String(form.get("inspectors") ?? "").trim() || null,
          content: String(form.get("content") ?? "").trim() || null,
          resultDetail: String(form.get("resultDetail") ?? "").trim() || null,
          findings: String(form.get("findings") ?? "").trim() || null,
          nextInspectionAt: String(form.get("nextInspectionAt") ?? "").trim() || null,
          requiresReinspection: form.get("requiresReinspection") === "true",
          note: String(form.get("note") ?? "").trim() || null,
          updatedBy: user.id,
          newAttachments,
        })
        return { ok: true }
      }
      case "inspection.delete": {
        const siteId = Number(form.get("siteId"))
        await requireSiteWriteAccess(request, siteId)
        await deleteInspection(String(form.get("id") ?? ""))
        return { ok: true }
      }
      case "inspection.chat": {
        await requireUser(request)
        const conversation = JSON.parse(String(form.get("conversation") ?? "[]")) as InspectionChatMessage[]
        if (conversation.length === 0 || conversation[conversation.length - 1]?.role !== "user") {
          return data({ error: "질문을 입력해 주세요." }, { status: 400 })
        }
        const sites = await listSites()
        const inspectionsBySiteId = new Map<number, Awaited<ReturnType<typeof listInspections>>>()
        await Promise.all(
          sites.map(async (site) => {
            inspectionsBySiteId.set(site.id, await listInspections(site.id))
          }),
        )
        const answer = await askAboutInspections(sites, inspectionsBySiteId, conversation)
        return { ok: true as const, answer }
      }
      case "inspection.parsePdf": {
        await requireUser(request)
        const file = form.get("file")
        if (!(file instanceof File) || file.size === 0) return data({ error: "PDF 파일을 선택해 주세요." }, { status: 400 })
        const buffer = Buffer.from(await file.arrayBuffer())
        const parsed = await parseInspectionReportPdf(buffer)
        return { ok: true as const, parsed }
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
  const { sites, selectedSite, inspections, attachmentUrls, canManage, canWrite, migrationPending, topTab } =
    useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const actionFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const siteFetcher = useFetcher<typeof action>()
  const [manageOpen, setManageOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingInspection, setEditingInspection] = useState<SiteInspection | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showAllInspections, setShowAllInspections] = useState(false)
  const [expandedInspectionId, setExpandedInspectionId] = useState<string | null>(null)

  const pageTitle = usePageMenuTitle("/sites", "현장 점검")
  const sorted = [...sites].sort((a, b) => a.sortOrder - b.sortOrder)
  const actionError =
    actionFetcher.data && "error" in actionFetcher.data
      ? actionFetcher.data.error
      : siteFetcher.data && "error" in siteFetcher.data
        ? siteFetcher.data.error
        : null
  const visibleInspections = showAllInspections ? inspections : inspections.slice(0, 1)

  function selectSite(id: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set("site", id)
      return params
    })
    setShowAllInspections(false)
  }

  function selectTopTab(value: string) {
    if (value === STANDARD_TAB_VALUE || value === AI_TAB_VALUE) {
      selectSite(value)
      return
    }
    // "현장 점검결과"로 전환 시, 이미 선택된 현장이 있으면 유지하고 없으면 첫 번째 현장을 기본 선택한다.
    selectSite(selectedSite ? String(selectedSite.id) : String(sorted[0]?.id ?? ""))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={pageTitle}
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
      ) : (
        <>
          <Tabs
            variant="folder"
            items={[
              { value: STANDARD_TAB_VALUE, label: "점검 프로세스" },
              { value: RESULTS_TAB_VALUE, label: "현장 점검결과" },
              { value: AI_TAB_VALUE, label: "AI 분석" },
            ]}
            value={topTab}
            onChange={selectTopTab}
          />

          {topTab === STANDARD_TAB_VALUE ? (
            <InspectionStandardGuide />
          ) : topTab === AI_TAB_VALUE ? (
            <InspectionAiAnalysisPanel />
          ) : sorted.length === 0 ? (
            <Card className="p-5">
              <EmptyState title="등록된 현장이 없습니다" description="현장 관리에서 현장을 먼저 추가하세요." />
            </Card>
          ) : (
            <>
              <Tabs
                items={sorted.map((site) => ({ value: String(site.id), label: site.name }))}
                value={selectedSite ? String(selectedSite.id) : ""}
                onChange={selectSite}
              />

              {!selectedSite ? (
                <Card className="p-5">
                  <EmptyState title="현장을 찾을 수 없습니다" description="다른 탭을 선택해 보세요." />
                </Card>
              ) : (
                <>
                <PageHeader
                  title={selectedSite.name}
                  description={`${selectedSite.address ?? "주소 미등록"} · 총 ${inspections.length}건 점검`}
                  actions={
                    canWrite ? (
                      <Button onClick={() => setFormOpen(true)}>
                        <Plus className="size-4" aria-hidden />
                        점검 기록 추가
                      </Button>
                    ) : null
                  }
                />

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
                                <button
                                  type="button"
                                  onClick={() => setExpandedInspectionId(expandedInspectionId === insp.id ? null : insp.id)}
                                  className="inline-flex items-center gap-1 text-left font-medium text-foreground hover:underline"
                                >
                                  {insp.title}
                                  {expandedInspectionId === insp.id ? (
                                    <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                  ) : (
                                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                  )}
                                </button>
                                <p className="text-sm text-muted-foreground">
                                  {insp.inspectorOrg} · {formatDate(insp.inspectedAt)}
                                  {insp.inspectedAtEnd ? ` ~ ${formatDate(insp.inspectedAtEnd)}` : ""}
                                  {insp.inspectionTime ? ` · ${insp.inspectionTime}` : ""}
                                  {insp.nextInspectionAt ? ` · 다음 점검 예정일 ${formatDate(insp.nextInspectionAt)}` : ""}
                                </p>

                                {expandedInspectionId === insp.id ? (
                                  <div className="overflow-hidden border-2 border-foreground">
                                    <InspectionReportTable inspection={insp} />
                                  </div>
                                ) : null}
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
                              <div className="flex items-center gap-1">
                                <Link to={`/sites/${selectedSite.id}/inspections/${insp.id}/print`} target="_blank" rel="noopener noreferrer">
                                  <Button type="button" variant="ghost" size="icon" aria-label="보고서 출력">
                                    <Printer className="size-4" aria-hidden />
                                  </Button>
                                </Link>
                                {canWrite ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="수정"
                                    onClick={() => setEditingInspection(insp)}
                                  >
                                    <Pencil className="size-4" aria-hidden />
                                  </Button>
                                ) : null}
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
                            </div>

                            {confirmingDeleteId === insp.id ? (
                              <div className="mt-3">
                                <ConfirmPanel
                                  title="이 점검 기록을 삭제할까요?"
                                  description="첨부파일을 포함해 함께 삭제되며 되돌릴 수 없습니다."
                                  onConfirm={() => {
                                    deleteFetcher.submit(
                                      { intent: "inspection.delete", id: insp.id, siteId: String(selectedSite.id) },
                                      { method: "post" },
                                    )
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

                {canWrite ? (
                  <InspectionFormModal
                    key={editingInspection?.id ?? "new"}
                    open={formOpen || editingInspection !== null}
                    onClose={() => {
                      setFormOpen(false)
                      setEditingInspection(null)
                    }}
                    siteId={selectedSite.id}
                    editingInspection={editingInspection}
                  />
                ) : null}
                </>
              )}
            </>
          )}
        </>
      )}

      {canManage ? (
        <SiteManageModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          sites={sites}
          pending={siteFetcher.state !== "idle"}
          onCreate={(name, address) => siteFetcher.submit({ intent: "site.create", name, address }, { method: "post" })}
          onRename={(id, name, address) =>
            siteFetcher.submit({ intent: "site.rename", id: String(id), name, address }, { method: "post" })
          }
          onDelete={(id) => siteFetcher.submit({ intent: "site.delete", id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) siteFetcher.submit({ intent: "site.reorder", items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}
    </div>
  )
}
