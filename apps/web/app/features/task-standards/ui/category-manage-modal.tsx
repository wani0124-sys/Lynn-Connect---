import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { StandardCategory } from "~/entities/task-standard/model/task-standard.types"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { DragHandle, SortableList } from "~/shared/ui/sortable-list"

export interface CategoryManageModalProps {
  open: boolean
  onClose: () => void
  categories: StandardCategory[]
  pending: boolean
  onCreate: (name: string, color: string) => void
  onRename: (id: number, name: string, color: string) => void
  onDelete: (id: number) => void
  onReorder: (items: { id: number; sortOrder: number }[]) => void
}

const DEFAULT_COLOR = "#6b7280"

export function CategoryManageModal({
  open,
  onClose,
  categories,
  pending,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: CategoryManageModalProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  function startEdit(category: StandardCategory) {
    setEditingId(category.id)
    setEditingName(category.name)
    setEditingColor(category.color)
  }

  function submitCreate() {
    if (!name.trim()) return
    onCreate(name.trim(), color)
    setName("")
    setColor(DEFAULT_COLOR)
  }

  function submitEdit() {
    if (editingId === null || !editingName.trim()) return
    onRename(editingId, editingName.trim(), editingColor)
    setEditingId(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="구분자 관리" description="구분자를 추가·수정·삭제하고 드래그해서 순서를 변경합니다">
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="새 구분자명" htmlFor="new-cat-name" className="flex-1">
            <Input id="new-cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="구분자명" />
          </Field>
          <Field label="색상" htmlFor="new-cat-color">
            <input
              id="new-cat-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 rounded-md border border-input"
            />
          </Field>
          <Button type="button" onClick={submitCreate} disabled={pending || !name.trim()}>
            <Plus className="size-4" aria-hidden />
            추가
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          <SortableList
            items={sorted}
            onReorder={(items) => onReorder(items.map((cat, index) => ({ id: cat.id, sortOrder: index })))}
            renderItem={(category, drag) =>
              editingId === category.id ? (
                <div className="flex items-center gap-2 p-3">
                  <input
                    type="color"
                    value={editingColor}
                    onChange={(e) => setEditingColor(e.target.value)}
                    className="h-9 w-12 rounded-md border border-input"
                  />
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1"
                    autoFocus
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
                  <div className="flex items-center gap-2">
                    <DragHandle {...drag} />
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="flex items-center gap-2 text-sm font-medium hover:underline"
                    >
                      <span className="inline-block size-3 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
                      {category.name}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(category.id)}
                    disabled={pending}
                    aria-label="삭제"
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              )
            }
          />
          {sorted.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 구분자가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
