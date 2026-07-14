import { useState } from "react"
import { Link, data, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { ChevronDown, ChevronUp, Download, FileWarning, Plus, Trash2 } from "lucide-react"
import { DiffView } from "~/entities/document/ui/diff-view"
import { PdfPageViewer } from "~/entities/document/ui/pdf-page-viewer"
import type { DocumentRevision } from "~/entities/document/model/document.types"
import { isHeadquarters } from "~/entities/member/model/member"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import {
  createRevision,
  deleteRevision,
  getRevisionFileUrl,
  getSeriesById,
  listRevisions,
} from "~/features/documents/model/documents.repository.server"
import { validateRevisionFile, validateRevisionLabel } from "~/features/documents/model/documents.schema"
import { RevisionUploadModal } from "~/features/documents/ui/revision-upload-modal"
import { formatDateTime } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"

function suggestNextRevisionLabel(revisions: DocumentRevision[]): string {
  if (revisions.length === 0) return "Rev.0"
  const latest = revisions[0]
  const match = latest.revisionLabel.match(/^(.*?)(\d+)$/)
  if (match) return `${match[1]}${Number(match[2]) + 1}`
  return ""
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const seriesId = Number(params.seriesId ?? "")

  try {
    const [series, revisions] = await Promise.all([getSeriesById(seriesId), listRevisions(seriesId)])

    let fileUrls: Record<string, string> = {}
    if (revisions.length > 0) {
      const entries = await Promise.all(
        revisions.map(async (rev) => [rev.id, (await getRevisionFileUrl(rev.id))?.url ?? null] as const),
      )
      fileUrls = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null))
    }

    return { series, revisions, fileUrls, canManage: isHeadquarters(user.role), migrationPending: false }
  } catch (error) {
    console.error("문서 정보를 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
    return { series: null, revisions: [], fileUrls: {}, canManage: false, migrationPending: true }
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireHeadquarters(request)
  const seriesId = Number(params.seriesId ?? "")
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "revision.create": {
        const revisionLabel = String(form.get("revisionLabel") ?? "").trim()
        const validationError = validateRevisionLabel(revisionLabel)
        if (validationError) return data({ error: validationError }, { status: 400 })

        const file = form.get("file")
        if (!(file instanceof File)) return data({ error: "파일을 선택해 주세요." }, { status: 400 })
        const fileError = validateRevisionFile(file)
        if (fileError) return data({ error: fileError }, { status: 400 })

        const buffer = Buffer.from(await file.arrayBuffer())
        await createRevision({
          seriesId,
          revisionLabel,
          effectiveDate: String(form.get("effectiveDate") ?? "").trim() || null,
          filename: file.name,
          mimeType: file.type || "application/pdf",
          content: buffer,
          uploadedBy: user.id,
        })
        return { ok: true }
      }
      case "revision.delete": {
        await deleteRevision(String(form.get("id") ?? ""))
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

export default function DocumentDetailRoute() {
  const { series, revisions, fileUrls, canManage, migrationPending } = useLoaderData<typeof loader>()
  const actionFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null)

  if (!series) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title={migrationPending ? "아직 DB 준비가 안 됐습니다" : "문서를 찾을 수 없습니다."}
          description={
            migrationPending
              ? "supabase/migrations/20260713100000_document_revisions.sql을 Supabase SQL Editor에서 실행한 뒤 새로고침하세요."
              : "삭제되었거나 잘못된 주소입니다."
          }
          action={
            <Link to="/documents">
              <Button variant="outline">목록으로</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const actionError = actionFetcher.data && "error" in actionFetcher.data ? actionFetcher.data.error : null
  const latestRevision = revisions[0] ?? null

  return (
    <div className="space-y-6">
      <Link to="/documents" className="text-sm text-muted-foreground hover:text-foreground">
        <span className="font-semibold text-foreground">[목록]</span> 문서 관리
      </Link>

      <PageHeader
        title={series.name}
        description={
          latestRevision
            ? `${series.description ?? ""}${series.description ? " · " : ""}최신 ${latestRevision.revisionLabel} · ${formatDateTime(latestRevision.createdAt)} 업로드`
            : (series.description ?? "아직 업로드된 리비전이 없습니다.")
        }
        actions={
          canManage ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="size-4" aria-hidden />
              새 리비전 업로드
            </Button>
          ) : null
        }
      />

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{latestRevision ? `${latestRevision.revisionLabel} (최신)` : "체크리스트"}</CardTitle>
          {latestRevision && fileUrls[latestRevision.id] ? (
            <a href={fileUrls[latestRevision.id]} download={latestRevision.filename}>
              <Button type="button" variant="outline" size="sm">
                <Download className="size-4" aria-hidden />
                다운로드
              </Button>
            </a>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {latestRevision && fileUrls[latestRevision.id] ? (
            <PdfPageViewer url={fileUrls[latestRevision.id]} title={series.name} />
          ) : (
            <div className="p-5">
              <EmptyState
                icon={<FileWarning className="size-8 text-muted-foreground" aria-hidden />}
                title="아직 업로드된 리비전이 없습니다"
                description="새 리비전을 업로드하면 여기에 바로 표시됩니다."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>리비전 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {revisions.length === 0 ? (
            <EmptyState title="리비전이 없습니다" description="새 리비전을 업로드해 보세요." />
          ) : (
            <ul className="divide-y divide-border">
              {revisions.map((rev, index) => {
                const isLatest = index === 0
                const isExpanded = expandedDiffId === rev.id
                return (
                  <li key={rev.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{rev.revisionLabel}</span>
                          {isLatest ? (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                              최신
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rev.effectiveDate ? `시행일 ${formatDateTime(rev.effectiveDate)} · ` : ""}
                          업로드 {formatDateTime(rev.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {fileUrls[rev.id] ? (
                          <a href={fileUrls[rev.id]} download={rev.filename}>
                            <Button type="button" variant="ghost" size="icon" aria-label="다운로드">
                              <Download className="size-4" aria-hidden />
                            </Button>
                          </a>
                        ) : null}
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="삭제"
                            onClick={() => setConfirmingDeleteId(rev.id)}
                          >
                            <Trash2 className="size-4 text-danger" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {rev.diff ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setExpandedDiffId(isExpanded ? null : rev.id)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          {isExpanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                          이전 리비전과 변경사항 비교
                        </button>
                        {isExpanded ? (
                          <div className="mt-2">
                            <DiffView diff={rev.diff} />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">최초 버전 (비교 대상 없음)</p>
                    )}

                    {confirmingDeleteId === rev.id ? (
                      <div className="mt-3">
                        <ConfirmPanel
                          title="이 리비전을 삭제할까요?"
                          description="원본 파일이 함께 삭제되며 되돌릴 수 없습니다."
                          onConfirm={() => {
                            deleteFetcher.submit({ intent: "revision.delete", id: rev.id }, { method: "post" })
                            setConfirmingDeleteId(null)
                          }}
                          onCancel={() => setConfirmingDeleteId(null)}
                          pending={deleteFetcher.state !== "idle"}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <RevisionUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          seriesId={series.id}
          nextRevisionLabel={suggestNextRevisionLabel(revisions)}
        />
      ) : null}
    </div>
  )
}
