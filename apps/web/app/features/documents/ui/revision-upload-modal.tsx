import { useEffect, useRef, useState, type DragEvent } from "react"
import { useFetcher } from "react-router"
import { FileText, Paperclip, X } from "lucide-react"
import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"

export interface RevisionUploadModalProps {
  open: boolean
  onClose: () => void
  seriesId: number
  nextRevisionLabel: string
}

interface RevisionActionData {
  error?: string
  ok?: boolean
}

export function RevisionUploadModal({ open, onClose, seriesId, nextRevisionLabel }: RevisionUploadModalProps) {
  const fetcher = useFetcher<RevisionActionData>()
  const [revisionLabel, setRevisionLabel] = useState(nextRevisionLabel)
  const [effectiveDate, setEffectiveDate] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const pending = fetcher.state !== "idle"
  const error = fetcher.data?.error

  useEffect(() => {
    if (open) setRevisionLabel(nextRevisionLabel)
  }, [open, nextRevisionLabel])

  function reset() {
    setRevisionLabel(nextRevisionLabel)
    setEffectiveDate("")
    setFile(null)
    setAttachments([])
    setDragOver(false)
  }

  function addAttachments(list: FileList | null) {
    if (!list) return
    setAttachments((prev) => [...prev, ...Array.from(list)])
  }

  function pickFile(candidate: File | undefined) {
    if (!candidate) return
    if (!candidate.name.toLowerCase().endsWith(".pdf")) return
    setFile(candidate)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    pickFile(event.dataTransfer.files?.[0])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function submit() {
    if (!revisionLabel.trim() || !file) return
    const formData = new FormData()
    formData.append("intent", "revision.create")
    formData.append("seriesId", String(seriesId))
    formData.append("revisionLabel", revisionLabel.trim())
    formData.append("effectiveDate", effectiveDate)
    formData.append("file", file)
    for (const att of attachments) formData.append("attachments", att)
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
      title="새 리비전 업로드"
      description="PDF를 업로드하면 직전 리비전과 자동으로 비교합니다"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !revisionLabel.trim() || !file}>
            {pending ? "업로드 중…" : "업로드"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="리비전 번호" htmlFor="rev-label" required>
            <Input id="rev-label" value={revisionLabel} onChange={(e) => setRevisionLabel(e.target.value)} placeholder="예: Rev.1" />
          </Field>
          <Field label="시행일자 (선택)" htmlFor="rev-date">
            <Input id="rev-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </Field>
        </div>

        <Field label="메인 파일 (PDF)" htmlFor="rev-file" required>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <FileText className="size-6 text-muted-foreground" aria-hidden />
            {file ? (
              <p className="text-sm font-medium text-foreground">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-foreground">클릭하거나 PDF 파일을 드래그하세요</p>
                <p className="text-xs text-muted-foreground">화면에 표시·비교되는 메인 파일입니다. PDF 1개만 가능합니다</p>
              </>
            )}
            <input
              ref={inputRef}
              id="rev-file"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>
        </Field>

        <Field label="추가 첨부파일 (선택)" htmlFor="rev-attachments">
          <input
            ref={attachmentInputRef}
            id="rev-attachments"
            type="file"
            multiple
            onChange={(e) => {
              addAttachments(e.target.files)
              e.target.value = ""
            }}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
          />
          <p className="mt-1 text-xs text-muted-foreground">메인 파일 외에 참고용으로 함께 올리는 서브 파일입니다. 형식 제한 없음</p>
        </Field>

        {attachments.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {attachments.map((att, index) => (
              <li key={`${att.name}-${index}`} className="flex items-center gap-2 p-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{att.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="제거"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
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
