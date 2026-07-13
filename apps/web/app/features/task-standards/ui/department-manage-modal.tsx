import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { StandardDepartment } from "~/entities/task-standard/model/task-standard.types"
import { cn } from "~/shared/lib/cn"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { Select } from "~/shared/ui/select"
import { DragHandle, SortableList, type DragHandleProps } from "~/shared/ui/sortable-list"

export interface DepartmentManageModalProps {
  open: boolean
  onClose: () => void
  departments: StandardDepartment[]
  pending: boolean
  onCreate: (name: string, parentId: number | null) => void
  onRename: (id: number, name: string, parentId: number | null) => void
  onDelete: (id: number) => void
  onReorder: (items: { id: number; sortOrder: number }[]) => void
}

function siblingsOf(departments: StandardDepartment[], parentId: number | null) {
  return departments.filter((dept) => dept.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function DepartmentManageModal({
  open,
  onClose,
  departments,
  pending,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: DepartmentManageModalProps) {
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingParentId, setEditingParentId] = useState("")

  const roots = siblingsOf(departments, null)

  function startEdit(dept: StandardDepartment) {
    setEditingId(dept.id)
    setEditingName(dept.name)
    setEditingParentId(dept.parentId !== null ? String(dept.parentId) : "")
  }

  function submitCreate() {
    if (!name.trim()) return
    onCreate(name.trim(), parentId ? Number(parentId) : null)
    setName("")
    setParentId("")
  }

  function submitEdit() {
    if (editingId === null || !editingName.trim()) return
    onRename(editingId, editingName.trim(), editingParentId ? Number(editingParentId) : null)
    setEditingId(null)
  }

  function handleReorderGroup(group: StandardDepartment[]) {
    onReorder(group.map((dept, index) => ({ id: dept.id, sortOrder: index })))
  }

  return (
    <Modal open={open} onClose={onClose} title="부서 관리" description="부서를 추가·수정·삭제하고 드래그해서 순서를 변경합니다">
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="새 부서명" htmlFor="new-dept-name" className="flex-1">
            <Input id="new-dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="부서명" />
          </Field>
          <Field label="상위 부서" htmlFor="new-dept-parent">
            <Select id="new-dept-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">(최상위)</option>
              {roots.map((root) => (
                <option key={root.id} value={root.id}>
                  {root.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="button" onClick={submitCreate} disabled={pending || !name.trim()}>
            <Plus className="size-4" aria-hidden />
            추가
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          <SortableList
            items={roots}
            onReorder={handleReorderGroup}
            renderItem={(root, drag) => (
              <div>
                <DepartmentRow
                  dept={root}
                  drag={drag}
                  editing={editingId === root.id}
                  editingName={editingName}
                  editingParentId={editingParentId}
                  roots={roots}
                  pending={pending}
                  onEdit={() => startEdit(root)}
                  onEditingNameChange={setEditingName}
                  onEditingParentIdChange={setEditingParentId}
                  onSubmitEdit={submitEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => onDelete(root.id)}
                />
                <SortableList
                  items={siblingsOf(departments, root.id)}
                  onReorder={handleReorderGroup}
                  className="divide-y divide-border"
                  renderItem={(child, childDrag) => (
                    <DepartmentRow
                      dept={child}
                      indent
                      drag={childDrag}
                      editing={editingId === child.id}
                      editingName={editingName}
                      editingParentId={editingParentId}
                      roots={roots}
                      pending={pending}
                      onEdit={() => startEdit(child)}
                      onEditingNameChange={setEditingName}
                      onEditingParentIdChange={setEditingParentId}
                      onSubmitEdit={submitEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onDelete={() => onDelete(child.id)}
                    />
                  )}
                />
              </div>
            )}
          />
          {roots.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 부서가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

interface DepartmentRowProps {
  dept: StandardDepartment
  indent?: boolean
  drag: DragHandleProps
  editing: boolean
  editingName: string
  editingParentId: string
  roots: StandardDepartment[]
  pending: boolean
  onEdit: () => void
  onEditingNameChange: (value: string) => void
  onEditingParentIdChange: (value: string) => void
  onSubmitEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

function DepartmentRow({
  dept,
  indent,
  drag,
  editing,
  editingName,
  editingParentId,
  roots,
  pending,
  onEdit,
  onEditingNameChange,
  onEditingParentIdChange,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
}: DepartmentRowProps) {
  if (editing) {
    return (
      <div className={cn("flex items-center gap-2 p-3", indent && "pl-8")}>
        <Input value={editingName} onChange={(e) => onEditingNameChange(e.target.value)} className="flex-1" autoFocus />
        <Select value={editingParentId} onChange={(e) => onEditingParentIdChange(e.target.value)}>
          <option value="">(최상위)</option>
          {roots
            .filter((root) => root.id !== dept.id)
            .map((root) => (
              <option key={root.id} value={root.id}>
                {root.name}
              </option>
            ))}
        </Select>
        <Button type="button" size="sm" onClick={onSubmitEdit} disabled={pending}>
          저장
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
          취소
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center justify-between gap-2 p-3", indent && "pl-8")}>
      <div className="flex items-center gap-2">
        <DragHandle {...drag} />
        <button type="button" onClick={onEdit} className="text-sm font-medium hover:underline">
          {dept.name}
        </button>
      </div>
      <Button type="button" size="icon" variant="ghost" onClick={onDelete} disabled={pending} aria-label="삭제">
        <Trash2 className="size-4 text-danger" aria-hidden />
      </Button>
    </div>
  )
}
