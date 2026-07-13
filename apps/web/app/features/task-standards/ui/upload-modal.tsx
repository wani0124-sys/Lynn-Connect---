import { useRef, useState, type DragEvent } from "react"
import { useFetcher } from "react-router"
import { Mail, X } from "lucide-react"
import { buildDepartmentOptions } from "~/entities/task-standard/lib/build-department-options"
import type { StandardCategory, StandardDepartment } from "~/entities/task-standard/model/task-standard.types"
import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"
import { Modal } from "~/shared/ui/modal"
import { Select } from "~/shared/ui/select"

export interface UploadModalProps {
  open: boolean
  onClose: () => void
  departments: StandardDepartment[]
  categories: StandardCategory[]
}

interface UploadActionData {
  formError?: string
  results?: { name: string; id: string }[]
  errors?: { name: string; error: string }[]
}

export function UploadModal({ open, onClose, departments, categories }: UploadModalProps) {
  const fetcher = useFetcher<UploadActionData>()
  const [files, setFiles] = useState<File[]>([])
  const [deptIds, setDeptIds] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const departmentOptions = buildDepartmentOptions(departments)
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  const pending = fetcher.state !== "idle"
  const data = fetcher.data

  function addFiles(list: FileList | File[] | null) {
    if (!list) return
    const incoming = Array.from(list).filter((file) => file.name.toLowerCase().endsWith(".eml"))
    if (incoming.length === 0) return
    setFiles((prev) => [...prev, ...incoming])
    setDeptIds((prev) => [...prev, ...incoming.map(() => "")])
    setCategoryIds((prev) => [...prev, ...incoming.map(() => "")])
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setDeptIds((prev) => prev.filter((_, i) => i !== index))
    setCategoryIds((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    addFiles(event.dataTransfer.files)
  }

  function handleClose() {
    setFiles([])
    setDeptIds([])
    setCategoryIds([])
    onClose()
  }

  function submit() {
    const formData = new FormData()
    for (const file of files) formData.append("eml", file)
    formData.append("dept_ids", JSON.stringify(deptIds))
    formData.append("category_ids", JSON.stringify(categoryIds))
    fetcher.submit(formData, { method: "post", action: "/standards/new", encType: "multipart/form-data" })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="EML 파일 업로드"
      description="본사 기준·공지 메일(.eml)을 여러 건 한 번에 업로드합니다 (최대 30개)"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            {data?.results ? "닫기" : "취소"}
          </Button>
          {!data?.results ? (
            <Button type="button" onClick={submit} disabled={pending || files.length === 0}>
              {pending ? "업로드 중…" : `업로드 (${files.length}건)`}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {data?.formError ? (
          <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{data.formError}</div>
        ) : null}

        {!data?.results ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
              )}
            >
              <Mail className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-foreground">클릭하거나 .eml 파일을 드래그하세요</p>
              <p className="text-xs text-muted-foreground">여러 파일을 한 번에 선택할 수 있습니다</p>
              <input
                ref={inputRef}
                type="file"
                accept=".eml"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </div>

            {files.length > 0 ? (
              <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex flex-wrap items-center gap-2 p-3">
                    <span className="flex-1 truncate text-sm font-medium">{file.name}</span>
                    <Select
                      value={deptIds[index] ?? ""}
                      onChange={(e) => setDeptIds((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                    >
                      <option value="">부서 없음</option>
                      {departmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={categoryIds[index] ?? ""}
                      onChange={(e) => setCategoryIds((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                    >
                      <option value="">구분자 없음</option>
                      {sortedCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(index)} aria-label="제거">
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            {data.results.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-success">성공 {data.results.length}건</p>
                <ul className="space-y-1 text-sm">
                  {data.results.map((result) => (
                    <li key={result.id}>{result.name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {data.errors && data.errors.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-danger">실패 {data.errors.length}건</p>
                <ul className="space-y-1 text-sm text-danger">
                  {data.errors.map((err, index) => (
                    <li key={index}>
                      {err.name}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  )
}
