import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { DocumentSeries } from "~/entities/document/model/document.types"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { DragHandle, SortableList } from "~/shared/ui/sortable-list"

export interface SeriesManageModalProps {
  open: boolean
  onClose: () => void
  series: DocumentSeries[]
  pending: boolean
  onCreate: (name: string, description: string) => void
  onRename: (id: number, name: string, description: string) => void
  onDelete: (id: number) => void
  onReorder: (items: { id: number; sortOrder: number }[]) => void
}

export function SeriesManageModal({ open, onClose, series, pending, onCreate, onRename, onDelete, onReorder }: SeriesManageModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingDescription, setEditingDescription] = useState("")

  const sorted = [...series].sort((a, b) => a.sortOrder - b.sortOrder)

  function startEdit(item: DocumentSeries) {
    setEditingId(item.id)
    setEditingName(item.name)
    setEditingDescription(item.description ?? "")
  }

  function submitCreate() {
    if (!name.trim()) return
    onCreate(name.trim(), description.trim())
    setName("")
    setDescription("")
  }

  function submitEdit() {
    if (editingId === null || !editingName.trim()) return
    onRename(editingId, editingName.trim(), editingDescription.trim())
    setEditingId(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="문서 관리" description="문서 시리즈를 추가·수정·삭제하고 드래그해서 순서를 변경합니다">
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="문서명" htmlFor="new-series-name" className="flex-1">
            <Input id="new-series-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 현장 주요 업무 체크리스트" />
          </Field>
          <Field label="설명 (선택)" htmlFor="new-series-description" className="flex-1">
            <Input id="new-series-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="문서 설명" />
          </Field>
          <Button type="button" onClick={submitCreate} disabled={pending || !name.trim()}>
            <Plus className="size-4" aria-hidden />
            추가
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          <SortableList
            items={sorted}
            onReorder={(items) => onReorder(items.map((item, index) => ({ id: item.id, sortOrder: index })))}
            renderItem={(item, drag) =>
              editingId === item.id ? (
                <div className="flex items-center gap-2 p-3">
                  <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1" autoFocus />
                  <Input
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    className="flex-1"
                    placeholder="문서 설명"
                  />
                  <Button type="button" size="sm" onClick={submitEdit} disabled={pending}>
                    저장
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    취소
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <DragHandle {...drag} />
                    <button type="button" onClick={() => startEdit(item)} className="min-w-0 text-left hover:underline">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      {item.description ? <span className="block truncate text-xs text-muted-foreground">{item.description}</span> : null}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(item.id)}
                    disabled={pending}
                    aria-label="삭제"
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              )
            }
          />
          {sorted.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 문서가 없습니다.</p> : null}
        </div>
      </div>
    </Modal>
  )
}
