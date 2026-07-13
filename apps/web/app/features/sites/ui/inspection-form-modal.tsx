import { useEffect, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Paperclip, X } from "lucide-react"
import { SITE_INSPECTION_RESULTS } from "~/entities/site/model/site.types"
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
}

interface InspectionActionData {
  error?: string
  ok?: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function InspectionFormModal({ open, onClose, siteId }: InspectionFormModalProps) {
  const fetcher = useFetcher<InspectionActionData>()
  const [title, setTitle] = useState("")
  const [inspectorOrg, setInspectorOrg] = useState("")
  const [inspectedAt, setInspectedAt] = useState(today())
  const [result, setResult] = useState<string>(SITE_INSPECTION_RESULTS[0])
  const [nextInspectionAt, setNextInspectionAt] = useState("")
  const [requiresReinspection, setRequiresReinspection] = useState(false)
  const [note, setNote] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const pending = fetcher.state !== "idle"
  const error = fetcher.data?.error

  function reset() {
    setTitle("")
    setInspectorOrg("")
    setInspectedAt(today())
    setResult(SITE_INSPECTION_RESULTS[0])
    setNextInspectionAt("")
    setRequiresReinspection(false)
    setNote("")
    setFiles([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  function submit() {
    if (!title.trim() || !inspectorOrg.trim() || !inspectedAt) return
    const formData = new FormData()
    formData.append("intent", "inspection.create")
    formData.append("siteId", String(siteId))
    formData.append("title", title.trim())
    formData.append("inspectorOrg", inspectorOrg.trim())
    formData.append("inspectedAt", inspectedAt)
    formData.append("result", result)
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
      title="점검 기록 추가"
      description="현장이 받은 대외 점검 내용을 기록합니다"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !title.trim() || !inspectorOrg.trim() || !inspectedAt}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        <Field label="점검명" htmlFor="insp-title" required>
          <Input id="insp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 정기 소방안전점검" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="점검기관/주체" htmlFor="insp-org" required>
            <Input id="insp-org" value={inspectorOrg} onChange={(e) => setInspectorOrg(e.target.value)} placeholder="예: OO구청, 감리단" />
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="점검일" htmlFor="insp-date" required>
            <Input id="insp-date" type="date" value={inspectedAt} onChange={(e) => setInspectedAt(e.target.value)} />
          </Field>
          <Field label="다음 점검 예정일 (선택)" htmlFor="insp-next-date">
            <Input id="insp-next-date" type="date" value={nextInspectionAt} onChange={(e) => setNextInspectionAt(e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={requiresReinspection} onChange={(e) => setRequiresReinspection(e.target.checked)} />
          재점검이 필요합니다
        </label>

        <Field label="비고 (선택)" htmlFor="insp-note">
          <Textarea id="insp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="특이사항을 입력하세요" />
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
