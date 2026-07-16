import { useEffect, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { FileUp, Paperclip, X } from "lucide-react"
import { SITE_INSPECTION_RESULTS, type SiteInspection } from "~/entities/site/model/site.types"
import { Button } from "~/shared/ui/button"
import { Checkbox } from "~/shared/ui/checkbox"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { Select } from "~/shared/ui/select"
import { Textarea } from "~/shared/ui/textarea"

export interface InspectionFormModalProps {
  open: boolean
  onClose: () => void
  siteId: number
  editingInspection?: SiteInspection | null
}

interface InspectionActionData {
  error?: string
  ok?: boolean
}

interface ParsedInspectionReport {
  title: string | null
  inspectorOrg: string | null
  inspectedAt: string | null
  inspectedAtEnd: string | null
  inspectionTime: string | null
  inspectors: string | null
  purpose: string | null
  findings: string | null
  result: string | null
  content: string | null
  resultDetail: string | null
}

interface ParsePdfActionData {
  ok?: boolean
  error?: string
  parsed?: ParsedInspectionReport
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function InspectionFormModal({ open, onClose, siteId, editingInspection = null }: InspectionFormModalProps) {
  const fetcher = useFetcher<InspectionActionData>()
  const parseFetcher = useFetcher<ParsePdfActionData>()
  const isEditing = editingInspection !== null
  const [title, setTitle] = useState(editingInspection?.title ?? "")
  const [inspectorOrg, setInspectorOrg] = useState(editingInspection?.inspectorOrg ?? "")
  const [inspectedAt, setInspectedAt] = useState(editingInspection?.inspectedAt ?? today())
  const [inspectedAtEnd, setInspectedAtEnd] = useState(editingInspection?.inspectedAtEnd ?? "")
  const [inspectionTime, setInspectionTime] = useState(editingInspection?.inspectionTime ?? "")
  const [result, setResult] = useState<string>(editingInspection?.result ?? SITE_INSPECTION_RESULTS[0])
  const [purpose, setPurpose] = useState(editingInspection?.purpose ?? "")
  const [inspectors, setInspectors] = useState(editingInspection?.inspectors ?? "")
  const [content, setContent] = useState(editingInspection?.content ?? "")
  const [resultDetail, setResultDetail] = useState(editingInspection?.resultDetail ?? "")
  const [findings, setFindings] = useState(editingInspection?.findings ?? "")
  const [nextInspectionAt, setNextInspectionAt] = useState(editingInspection?.nextInspectionAt ?? "")
  const [requiresReinspection, setRequiresReinspection] = useState(editingInspection?.requiresReinspection ?? false)
  const [note, setNote] = useState(editingInspection?.note ?? "")
  const [files, setFiles] = useState<File[]>([])
  const [autofillApplied, setAutofillApplied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pending = fetcher.state !== "idle"
  const error = fetcher.data?.error

  function reset() {
    setTitle("")
    setInspectorOrg("")
    setInspectedAt(today())
    setInspectedAtEnd("")
    setInspectionTime("")
    setResult(SITE_INSPECTION_RESULTS[0])
    setPurpose("")
    setInspectors("")
    setContent("")
    setResultDetail("")
    setFindings("")
    setNextInspectionAt("")
    setRequiresReinspection(false)
    setNote("")
    setFiles([])
    setAutofillApplied(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  function applyParsed(parsed: ParsedInspectionReport) {
    if (parsed.title) setTitle(parsed.title)
    if (parsed.inspectorOrg) setInspectorOrg(parsed.inspectorOrg)
    if (parsed.inspectedAt) setInspectedAt(parsed.inspectedAt)
    if (parsed.inspectedAtEnd) setInspectedAtEnd(parsed.inspectedAtEnd)
    if (parsed.inspectionTime) setInspectionTime(parsed.inspectionTime)
    if (parsed.result && (SITE_INSPECTION_RESULTS as string[]).includes(parsed.result)) setResult(parsed.result)
    if (parsed.purpose) setPurpose(parsed.purpose)
    if (parsed.inspectors) setInspectors(parsed.inspectors)
    if (parsed.content) setContent(parsed.content)
    if (parsed.resultDetail) setResultDetail(parsed.resultDetail)
    if (parsed.findings) setFindings(parsed.findings)
  }

  function handlePdfAutofill(file: File | undefined) {
    if (!file) return
    setFiles((prev) => [...prev, file])
    const formData = new FormData()
    formData.append("intent", "inspection.parsePdf")
    formData.append("file", file)
    parseFetcher.submit(formData, { method: "post", encType: "multipart/form-data" })
  }

  useEffect(() => {
    if (parseFetcher.state === "idle" && parseFetcher.data?.ok && parseFetcher.data.parsed) {
      applyParsed(parseFetcher.data.parsed)
      setAutofillApplied(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseFetcher.state, parseFetcher.data])

  function submit() {
    if (!title.trim() || !inspectorOrg.trim() || !inspectedAt) return
    const formData = new FormData()
    formData.append("intent", isEditing ? "inspection.update" : "inspection.create")
    if (editingInspection) formData.append("id", editingInspection.id)
    formData.append("siteId", String(siteId))
    formData.append("title", title.trim())
    formData.append("inspectorOrg", inspectorOrg.trim())
    formData.append("inspectedAt", inspectedAt)
    formData.append("inspectedAtEnd", inspectedAtEnd)
    formData.append("inspectionTime", inspectionTime.trim())
    formData.append("result", result)
    formData.append("purpose", purpose.trim())
    formData.append("inspectors", inspectors.trim())
    formData.append("content", content.trim())
    formData.append("resultDetail", resultDetail.trim())
    formData.append("findings", findings.trim())
    formData.append("nextInspectionAt", nextInspectionAt)
    formData.append("requiresReinspection", requiresReinspection ? "true" : "false")
    formData.append("note", note.trim())
    for (const file of files) formData.append("files", file)
    fetcher.submit(formData, { method: "post", encType: "multipart/form-data" })
  }

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      handleClose()
    }
  }, [fetcher.state, fetcher.data])

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? "점검 기록 수정" : "점검 기록 추가"}
      description="현장이 받은 대외 점검 내용을 결과보고 양식에 맞춰 기록합니다"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !title.trim() || !inspectorOrg.trim() || !inspectedAt}>
            {pending ? "저장 중…" : isEditing ? "수정" : "저장"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        <div className="rounded-md border border-dashed border-primary/40 bg-accent p-3">
          <Field
            label="결과보고 PDF로 자동 채우기 (선택)"
            htmlFor="insp-pdf-autofill"
            hint="점검기관에서 받은 결과보고 PDF를 올리면 아래 항목을 자동으로 채웁니다. 추출 결과는 완벽하지 않을 수 있으니 저장 전에 꼭 확인하세요."
          >
            <input
              id="insp-pdf-autofill"
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                handlePdfAutofill(e.target.files?.[0])
                e.target.value = ""
              }}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
          </Field>
          {parseFetcher.state !== "idle" ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <FileUp className="size-3.5" aria-hidden />
              PDF 분석 중…
            </p>
          ) : parseFetcher.data?.error ? (
            <p className="mt-2 text-xs text-danger">{parseFetcher.data.error}</p>
          ) : autofillApplied ? (
            <p className="mt-2 text-xs text-success">PDF에서 추출한 내용을 아래 항목에 채웠습니다. 확인 후 저장하세요.</p>
          ) : null}
        </div>

        <Field label="점검명" htmlFor="insp-title" required>
          <Input id="insp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 건설공사 품질관리 적절성 확인 등 점검" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="점검기관/주체" htmlFor="insp-org" required>
            <Input
              id="insp-org"
              value={inspectorOrg}
              onChange={(e) => setInspectorOrg(e.target.value)}
              placeholder="예: 부산광역시 건설안전시험사업소 및 기장군청 건축과"
            />
          </Field>
          <Field label="점검 결과" htmlFor="insp-result" required>
            <Select id="insp-result" value={result} onChange={(e) => setResult(e.target.value)} className="w-full">
              {SITE_INSPECTION_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="점검 시작일" htmlFor="insp-date" required>
            <Input id="insp-date" type="date" value={inspectedAt} onChange={(e) => setInspectedAt(e.target.value)} />
          </Field>
          <Field label="점검 종료일 (선택)" htmlFor="insp-date-end" hint="여러 날에 걸친 점검이면 입력">
            <Input id="insp-date-end" type="date" value={inspectedAtEnd} onChange={(e) => setInspectedAtEnd(e.target.value)} />
          </Field>
          <Field label="점검 시간 (선택)" htmlFor="insp-time">
            <Input
              id="insp-time"
              value={inspectionTime}
              onChange={(e) => setInspectionTime(e.target.value)}
              placeholder="예: 각 10:00 ~ 15:00"
            />
          </Field>
        </div>

        <Field label="점검취지 (선택)" htmlFor="insp-purpose">
          <Textarea
            id="insp-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="이 점검을 실시하는 목적을 입력하세요"
          />
        </Field>

        <Field label="점검자 (선택)" htmlFor="insp-inspectors" hint="소속·성명·인원수를 줄바꿈으로 구분해 입력">
          <Textarea
            id="insp-inspectors"
            value={inspectors}
            onChange={(e) => setInspectors(e.target.value)}
            placeholder={"점검인원 (총 4명)\n부산광역시 건설안전시험사업소 품질혁신팀 3명\n기장군청 건축과 1명"}
          />
        </Field>

        <Field label="점검내용 (선택)" htmlFor="insp-content" hint="점검 항목을 줄바꿈으로 나열">
          <Textarea
            id="insp-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"- 품질관리계획서 승인 및 이행 상태\n- 품질관리자 배치, 자격 및 교육이수 현황"}
          />
        </Field>

        <Field label="점검결과 상세 (선택)" htmlFor="insp-result-detail" hint="점검 결과의 세부 내용을 줄바꿈으로 나열">
          <Textarea
            id="insp-result-detail"
            value={resultDetail}
            onChange={(e) => setResultDetail(e.target.value)}
            placeholder={"- 품질관리계획 및 관련 품질서류의 작성·이행 상태 전반적으로 우수\n- 별도의 시정·보완 지적사항은 없음"}
          />
        </Field>

        <Field label="지적사항/요청사항 (선택)" htmlFor="insp-findings">
          <Textarea
            id="insp-findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder={"요청사항 1건\n※ 균열 보수 완료 시 보수 현황 작성 및 준공 시까지 균열관리대장 관리 철저"}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="다음 점검 예정일 (선택)" htmlFor="insp-next-date">
            <Input id="insp-next-date" type="date" value={nextInspectionAt} onChange={(e) => setNextInspectionAt(e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={requiresReinspection} onChange={(e) => setRequiresReinspection(e.target.checked)} />
          재점검이 필요합니다
        </label>

        <Field label="비고 (선택)" htmlFor="insp-note">
          <Textarea id="insp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="그 외 특이사항을 입력하세요" />
        </Field>

        <Field label="첨부파일 (선택)" htmlFor="insp-files">
          <input
            ref={inputRef}
            id="insp-files"
            type="file"
            multiple
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
          />
        </Field>

        {files.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="제거"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}
