import { useEffect, useRef, useState, type DragEvent } from "react"
import { useFetcher } from "react-router"
import { CheckCircle2, ChevronDown, ChevronUp, FileText, FileUp, Loader2, X } from "lucide-react"
import { SITE_INSPECTION_RESULTS } from "~/entities/site/model/site.types"
import { MAX_INSPECTION_ATTACHMENT_SIZE_BYTES } from "~/features/sites/model/sites.schema"
import type { ParsePdfActionData, ParsedInspectionReport } from "~/features/sites/ui/inspection-form-modal"
import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { Select } from "~/shared/ui/select"
import { Textarea } from "~/shared/ui/textarea"

const MAX_FILES = 10
// AI 분석은 건당 10~30초가 걸려 동시에 몇 건씩 돌리되, 한꺼번에 몰려 요청 한도에 걸리지 않게 제한한다.
const PARSE_CONCURRENCY = 3

interface Draft {
  title: string
  inspectorOrg: string
  inspectedAt: string
  inspectedAtEnd: string
  inspectionTime: string
  result: string
  purpose: string
  inspectors: string
  content: string
  resultDetail: string
  findings: string
}

type ParseStatus = "queued" | "parsing" | "done"
type SaveStatus = "idle" | "saving" | "saved" | "error"

interface BulkItem {
  key: string
  file: File
  parse: ParseStatus
  parseError: string | null
  save: SaveStatus
  saveError: string | null
  draft: Draft
}

interface SaveActionData {
  ok?: boolean
  error?: string
}

function emptyDraft(): Draft {
  return {
    title: "",
    inspectorOrg: "",
    inspectedAt: "",
    inspectedAtEnd: "",
    inspectionTime: "",
    result: SITE_INSPECTION_RESULTS[0],
    purpose: "",
    inspectors: "",
    content: "",
    resultDetail: "",
    findings: "",
  }
}

function draftFromParsed(parsed: ParsedInspectionReport): Draft {
  const result = parsed.result && (SITE_INSPECTION_RESULTS as string[]).includes(parsed.result) ? parsed.result : SITE_INSPECTION_RESULTS[0]
  return {
    title: parsed.title ?? "",
    inspectorOrg: parsed.inspectorOrg ?? "",
    inspectedAt: parsed.inspectedAt ?? "",
    inspectedAtEnd: parsed.inspectedAtEnd ?? "",
    inspectionTime: parsed.inspectionTime ?? "",
    result,
    purpose: parsed.purpose ?? "",
    inspectors: parsed.inspectors ?? "",
    content: parsed.content ?? "",
    resultDetail: parsed.resultDetail ?? "",
    findings: parsed.findings ?? "",
  }
}

function isDraftComplete(draft: Draft): boolean {
  return Boolean(draft.title.trim() && draft.inspectorOrg.trim() && draft.inspectedAt)
}

export interface InspectionBulkUploadModalProps {
  open: boolean
  onClose: () => void
  siteId: number
}

// 결과보고 PDF 여러 개를 한 번에 올려 점검 기록을 여러 건 만든다. 각 PDF는 단건 추가와 같은
// inspection.parsePdf / inspection.create 요청을 그대로 써서, 분석은 몇 건씩 동시에, 저장은 한 건씩 차례로 한다.
export function InspectionBulkUploadModal({ open, onClose, siteId }: InspectionBulkUploadModalProps) {
  const [items, setItems] = useState<BulkItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const keySeq = useRef(0)

  const parsingCount = items.filter((item) => item.parse === "parsing").length
  const anyParsingOrQueued = items.some((item) => item.parse !== "done")
  const anySaving = items.some((item) => item.save === "saving")
  const unsaved = items.filter((item) => item.save !== "saved")
  const incompleteCount = unsaved.filter((item) => item.parse === "done" && !isDraftComplete(item.draft)).length

  // 동시에 분석할 건: 대기 중인 건 중 앞에서부터 남은 자리만큼
  const parseSlots = Math.max(0, PARSE_CONCURRENCY - parsingCount)
  const parseStartKeys = new Set(
    items
      .filter((item) => item.parse === "queued")
      .slice(0, parseSlots)
      .map((item) => item.key),
  )
  // 저장은 한 건씩: 저장 중인 건이 없을 때 다음 저장 대상 하나
  const nextSaveKey =
    savingAll && !anySaving ? (items.find((item) => item.parse === "done" && item.save === "idle")?.key ?? null) : null

  useEffect(() => {
    if (!savingAll || anySaving || nextSaveKey !== null) return
    setSavingAll(false)
    if (items.length > 0 && items.every((item) => item.save === "saved")) handleClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savingAll, anySaving, nextSaveKey])

  function updateItem(key: string, patch: Partial<BulkItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function updateDraft(key: string, patch: Partial<Draft>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, draft: { ...item.draft, ...patch } } : item)))
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const all = Array.from(list)
    const pdfs = all.filter((file) => file.name.toLowerCase().endsWith(".pdf"))
    const sized = pdfs.filter((file) => file.size > 0 && file.size <= MAX_INSPECTION_ATTACHMENT_SIZE_BYTES)
    const room = Math.max(0, MAX_FILES - items.length)
    const accepted = sized.slice(0, room)

    const skipped: string[] = []
    if (pdfs.length < all.length) skipped.push(`PDF가 아닌 파일 ${all.length - pdfs.length}개`)
    if (sized.length < pdfs.length) skipped.push(`30MB를 넘는 파일 ${pdfs.length - sized.length}개`)
    if (accepted.length < sized.length) skipped.push(`한 번에 ${MAX_FILES}개를 넘는 파일 ${sized.length - accepted.length}개`)
    setNotice(skipped.length ? `${skipped.join(", ")}는 제외했습니다.` : null)

    setItems((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        key: `bulk-${keySeq.current++}`,
        file,
        parse: "queued" as const,
        parseError: null,
        save: "idle" as const,
        saveError: null,
        draft: emptyDraft(),
      })),
    ])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    addFiles(event.dataTransfer.files)
  }

  function handleClose() {
    setItems([])
    setNotice(null)
    setDragOver(false)
    setSavingAll(false)
    onClose()
  }

  function startSaveAll() {
    // 실패했던 건은 다시 시도 대상으로 되돌린다
    setItems((prev) => prev.map((item) => (item.save === "error" ? { ...item, save: "idle", saveError: null } : item)))
    setSavingAll(true)
  }

  const busy = anyParsingOrQueued || savingAll
  const canSave = !busy && unsaved.length > 0 && incompleteCount === 0
  const savedCount = items.length - unsaved.length

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : handleClose}
      title="점검 기록 여러 건 올리기"
      description="결과보고 PDF를 여러 개 올리면 AI가 각각 읽어 점검 기록을 만듭니다"
      className="max-w-3xl"
      footer={
        <>
          {incompleteCount > 0 && !busy ? (
            <p className="mr-auto text-xs text-danger">필수 항목(점검명·점검기관·시작일)이 빈 건이 {incompleteCount}건 있습니다.</p>
          ) : savedCount > 0 ? (
            <p className="mr-auto text-xs text-muted-foreground">{savedCount}건 저장됨</p>
          ) : null}
          <Button type="button" variant="ghost" onClick={handleClose} disabled={busy}>
            {savedCount > 0 ? "닫기" : "취소"}
          </Button>
          <Button type="button" onClick={startSaveAll} disabled={!canSave}>
            {savingAll ? "저장 중…" : anyParsingOrQueued ? "분석 중…" : `${unsaved.length}건 모두 저장`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-5 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-primary/30 bg-accent hover:bg-muted/40",
          )}
        >
          <FileUp className="size-5 text-primary" aria-hidden />
          <p className="text-sm text-foreground">클릭하거나 결과보고 PDF 여러 개를 드래그하세요</p>
          <p className="text-xs text-muted-foreground">
            한 번에 최대 {MAX_FILES}개. 추출 결과는 완벽하지 않을 수 있으니 저장 전에 꼭 확인하세요.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </div>

        {notice ? <p className="text-xs text-danger">{notice}</p> : null}

        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <BulkItemRow
                key={item.key}
                item={item}
                siteId={siteId}
                startParse={parseStartKeys.has(item.key)}
                startSave={nextSaveKey === item.key}
                onUpdate={(patch) => updateItem(item.key, patch)}
                onDraftChange={(patch) => updateDraft(item.key, patch)}
                onRemove={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}

interface BulkItemRowProps {
  item: BulkItem
  siteId: number
  startParse: boolean
  startSave: boolean
  onUpdate: (patch: Partial<BulkItem>) => void
  onDraftChange: (patch: Partial<Draft>) => void
  onRemove: () => void
}

function BulkItemRow({ item, siteId, startParse, startSave, onUpdate, onDraftChange, onRemove }: BulkItemRowProps) {
  const parseFetcher = useFetcher<ParsePdfActionData>()
  const saveFetcher = useFetcher<SaveActionData>()
  const [expanded, setExpanded] = useState(false)
  const { draft } = item
  const idPrefix = `bulk-${item.key}`

  useEffect(() => {
    if (!startParse || item.parse !== "queued") return
    onUpdate({ parse: "parsing" })
    const formData = new FormData()
    formData.append("intent", "inspection.parsePdf")
    formData.append("file", item.file)
    parseFetcher.submit(formData, { method: "post", encType: "multipart/form-data" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startParse, item.parse])

  useEffect(() => {
    if (item.parse !== "parsing" || parseFetcher.state !== "idle" || !parseFetcher.data) return
    if (parseFetcher.data.ok && parseFetcher.data.parsed) {
      onUpdate({ parse: "done", draft: draftFromParsed(parseFetcher.data.parsed) })
    } else {
      onUpdate({ parse: "done", parseError: parseFetcher.data.error ?? "PDF를 읽지 못했습니다." })
      setExpanded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseFetcher.state, parseFetcher.data])

  useEffect(() => {
    if (!startSave || item.save !== "idle") return
    onUpdate({ save: "saving" })
    const formData = new FormData()
    formData.append("intent", "inspection.create")
    formData.append("siteId", String(siteId))
    formData.append("title", draft.title.trim())
    formData.append("inspectorOrg", draft.inspectorOrg.trim())
    formData.append("inspectedAt", draft.inspectedAt)
    formData.append("inspectedAtEnd", draft.inspectedAtEnd)
    formData.append("inspectionTime", draft.inspectionTime.trim())
    formData.append("result", draft.result)
    formData.append("purpose", draft.purpose.trim())
    formData.append("inspectors", draft.inspectors.trim())
    formData.append("content", draft.content.trim())
    formData.append("resultDetail", draft.resultDetail.trim())
    formData.append("findings", draft.findings.trim())
    formData.append("nextInspectionAt", "")
    formData.append("requiresReinspection", "false")
    formData.append("note", "")
    formData.append("files", item.file)
    saveFetcher.submit(formData, { method: "post", encType: "multipart/form-data" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSave, item.save])

  useEffect(() => {
    if (item.save !== "saving" || saveFetcher.state !== "idle" || !saveFetcher.data) return
    if (saveFetcher.data.ok) onUpdate({ save: "saved" })
    else onUpdate({ save: "error", saveError: saveFetcher.data.error ?? "저장하지 못했습니다." })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveFetcher.state, saveFetcher.data])

  const locked = item.parse !== "done" || item.save === "saving" || item.save === "saved"

  return (
    <li className={cn("rounded-lg border border-border", item.save === "saved" && "bg-muted/40")}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.file.name}</span>
        <StatusLabel item={item} />
        {item.parse === "done" && item.save !== "saved" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={expanded ? "세부 내용 접기" : "세부 내용 펼치기"}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="목록에서 빼기"
          onClick={onRemove}
          disabled={item.parse === "parsing" || item.save === "saving" || item.save === "saved"}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {item.parse === "done" && item.save !== "saved" ? (
        <div className="space-y-3 p-3">
          {item.parseError ? (
            <p className="text-xs text-danger">{item.parseError} 아래 항목을 직접 입력해 주세요.</p>
          ) : null}
          {item.saveError ? <p className="text-xs text-danger">{item.saveError}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="점검명" htmlFor={`${idPrefix}-title`} required>
              <Input
                id={`${idPrefix}-title`}
                value={draft.title}
                disabled={locked}
                onChange={(e) => onDraftChange({ title: e.target.value })}
              />
            </Field>
            <Field label="점검기관/주체" htmlFor={`${idPrefix}-org`} required>
              <Input
                id={`${idPrefix}-org`}
                value={draft.inspectorOrg}
                disabled={locked}
                onChange={(e) => onDraftChange({ inspectorOrg: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="점검 시작일" htmlFor={`${idPrefix}-date`} required>
              <Input
                id={`${idPrefix}-date`}
                type="date"
                value={draft.inspectedAt}
                disabled={locked}
                onChange={(e) => onDraftChange({ inspectedAt: e.target.value })}
              />
            </Field>
            <Field label="점검 종료일" htmlFor={`${idPrefix}-date-end`}>
              <Input
                id={`${idPrefix}-date-end`}
                type="date"
                value={draft.inspectedAtEnd}
                disabled={locked}
                onChange={(e) => onDraftChange({ inspectedAtEnd: e.target.value })}
              />
            </Field>
            <Field label="점검 시간" htmlFor={`${idPrefix}-time`}>
              <Input
                id={`${idPrefix}-time`}
                value={draft.inspectionTime}
                disabled={locked}
                onChange={(e) => onDraftChange({ inspectionTime: e.target.value })}
              />
            </Field>
            <Field label="점검 결과" htmlFor={`${idPrefix}-result`} required>
              <Select
                id={`${idPrefix}-result`}
                value={draft.result}
                disabled={locked}
                onChange={(e) => onDraftChange({ result: e.target.value })}
                className="w-full"
              >
                {SITE_INSPECTION_RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {expanded ? (
            <div className="space-y-3">
              <Field label="점검취지" htmlFor={`${idPrefix}-purpose`}>
                <Textarea
                  id={`${idPrefix}-purpose`}
                  value={draft.purpose}
                  disabled={locked}
                  onChange={(e) => onDraftChange({ purpose: e.target.value })}
                />
              </Field>
              <Field label="점검자" htmlFor={`${idPrefix}-inspectors`}>
                <Textarea
                  id={`${idPrefix}-inspectors`}
                  value={draft.inspectors}
                  disabled={locked}
                  onChange={(e) => onDraftChange({ inspectors: e.target.value })}
                />
              </Field>
              <Field label="점검내용" htmlFor={`${idPrefix}-content`}>
                <Textarea
                  id={`${idPrefix}-content`}
                  value={draft.content}
                  disabled={locked}
                  onChange={(e) => onDraftChange({ content: e.target.value })}
                />
              </Field>
              <Field label="점검결과 상세" htmlFor={`${idPrefix}-result-detail`}>
                <Textarea
                  id={`${idPrefix}-result-detail`}
                  value={draft.resultDetail}
                  disabled={locked}
                  onChange={(e) => onDraftChange({ resultDetail: e.target.value })}
                />
              </Field>
              <Field label="지적사항/요청사항" htmlFor={`${idPrefix}-findings`}>
                <Textarea
                  id={`${idPrefix}-findings`}
                  value={draft.findings}
                  disabled={locked}
                  onChange={(e) => onDraftChange({ findings: e.target.value })}
                />
              </Field>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              점검취지·점검자·점검내용·결과 상세·지적사항 보기
            </button>
          )}
        </div>
      ) : null}
    </li>
  )
}

function StatusLabel({ item }: { item: BulkItem }) {
  if (item.parse === "queued") return <span className="text-xs text-muted-foreground">대기 중</span>
  if (item.parse === "parsing")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        분석 중…
      </span>
    )
  if (item.save === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        저장 중…
      </span>
    )
  if (item.save === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="size-3.5" aria-hidden />
        저장됨
      </span>
    )
  if (item.save === "error") return <span className="text-xs text-danger">저장 실패</span>
  if (item.parseError) return <span className="text-xs text-danger">분석 실패</span>
  return <span className="text-xs text-success">분석 완료</span>
}
