import { useEffect, useRef, useState, type DragEvent } from "react"
import { useFetcher } from "react-router"
import { FileText } from "lucide-react"
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
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pending = fetcher.state !== "idle"
  const error = fetcher.data?.error

  useEffect(() => {
    if (open) setRevisionLabel(nextRevisionLabel)
  }, [open, nextRevisionLabel])

  function reset() {
    setRevisionLabel(nextRevisionLabel)
    setEffectiveDate("")
    setFile(null)
    setDragOver(false)
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

        <Field label="PDF 파일" htmlFor="rev-file" required>
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
                <p className="text-xs text-muted-foreground">PDF 파일 1개만 업로드할 수 있습니다</p>
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
      </div>
    </Modal>
  )
}
