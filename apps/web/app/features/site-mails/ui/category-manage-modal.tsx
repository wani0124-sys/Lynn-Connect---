import { useState } from "react"
import { CornerDownRight, Plus, Trash2 } from "lucide-react"
import { getCategoryWithDescendantIds, getChildCategories } from "~/entities/site-mail/lib/category-tree"
import { SITE_MAIL_CATEGORY_MAX_DEPTH, type SiteMailCategory } from "~/entities/site-mail/model/site-mail.types"
import { Button } from "~/shared/ui/button"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { DragHandle, SortableList } from "~/shared/ui/sortable-list"

export interface SiteMailCategoryManageModalProps {
  open: boolean
  onClose: () => void
  categories: SiteMailCategory[]
  pending: boolean
  onCreate: (name: string, color: string, parentId: number | null) => void
  onRename: (id: number, name: string, color: string) => void
  onDelete: (id: number) => void
  onReorder: (items: { id: number; sortOrder: number }[]) => void
}

const DEFAULT_COLOR = "#6b7280"

// 현장 메일함 구분자 관리(최대 3단계). task-standards/ui/category-manage-modal.tsx를 바탕으로
// 각 구분자 아래에 하위 구분자를 추가할 수 있게 나무 모양으로 보여준다. 드래그 순서 변경은 같은 단계 안에서만 된다.
export function SiteMailCategoryManageModal({
  open,
  onClose,
  categories,
  pending,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: SiteMailCategoryManageModalProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)
  // 하위 구분자 입력칸을 연 상위 구분자 id.
  const [addingParentId, setAddingParentId] = useState<number | null>(null)
  const [childName, setChildName] = useState("")
  const [childColor, setChildColor] = useState(DEFAULT_COLOR)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function startEdit(category: SiteMailCategory) {
    setEditingId(category.id)
    setEditingName(category.name)
    setEditingColor(category.color)
  }

  function startAddChild(parent: SiteMailCategory) {
    setAddingParentId(parent.id)
    setChildName("")
    // 하위 구분자는 처음에 상위 구분자 색을 따른다(바꿀 수 있음).
    setChildColor(parent.color)
  }

  function submitCreate() {
    if (!name.trim()) return
    onCreate(name.trim(), color, null)
    setName("")
    setColor(DEFAULT_COLOR)
  }

  function submitChild() {
    if (addingParentId === null || !childName.trim()) return
    onCreate(childName.trim(), childColor, addingParentId)
    setChildName("")
  }

  function submitEdit() {
    if (editingId === null || !editingName.trim()) return
    onRename(editingId, editingName.trim(), editingColor)
    setEditingId(null)
  }

  function requestDelete(category: SiteMailCategory) {
    // 하위 구분자가 있으면 함께 지워지므로 한 번 더 확인한다.
    if (getChildCategories(categories, category.id).length) setConfirmDeleteId(category.id)
    else onDelete(category.id)
  }

  function renderLevel(parentId: number | null, depth: number) {
    const siblings = getChildCategories(categories, parentId)
    if (!siblings.length) return null
    return (
      <SortableList
        items={siblings}
        className={depth > 1 ? "border-l border-border pl-3 ml-6" : undefined}
        onReorder={(items) => onReorder(items.map((cat, index) => ({ id: cat.id, sortOrder: index })))}
        renderItem={(category, drag) => (
          <div>
            {editingId === category.id ? (
              <div className="flex items-center gap-2 py-2 pr-3">
                <input
                  type="color"
                  value={editingColor}
                  onChange={(e) => setEditingColor(e.target.value)}
                  className="h-9 w-12 rounded-md border border-input"
                />
                <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1" autoFocus />
                <Button type="button" size="sm" onClick={submitEdit} disabled={pending}>
                  저장
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  취소
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 py-2 pr-3">
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
                  <span className="text-xs text-muted-foreground">{depth}단계</span>
                </div>
                <div className="flex items-center gap-1">
                  {depth < SITE_MAIL_CATEGORY_MAX_DEPTH ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => startAddChild(category)} disabled={pending}>
                      <Plus className="size-4" aria-hidden />
                      하위 추가
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => requestDelete(category)}
                    disabled={pending}
                    aria-label="삭제"
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </div>
            )}

            {confirmDeleteId === category.id ? (
              <ConfirmPanel
                className="mb-2 mr-3"
                title={`"${category.name}" 구분자를 삭제할까요?`}
                description={`하위 구분자 ${getCategoryWithDescendantIds(categories, category.id).length - 1}개도 함께 삭제되고, 붙어 있던 메일은 구분자 "없음"이 됩니다.`}
                onConfirm={() => {
                  setConfirmDeleteId(null)
                  onDelete(category.id)
                }}
                onCancel={() => setConfirmDeleteId(null)}
                pending={pending}
              />
            ) : null}

            {renderLevel(category.id, depth + 1)}

            {addingParentId === category.id ? (
              <div className="ml-6 flex items-center gap-2 border-l border-border py-2 pl-3 pr-3">
                <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="color"
                  value={childColor}
                  onChange={(e) => setChildColor(e.target.value)}
                  className="h-9 w-12 rounded-md border border-input"
                  aria-label="하위 구분자 색상"
                />
                <Input
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      submitChild()
                    }
                  }}
                  placeholder={`${category.name}의 하위 구분자명`}
                  className="flex-1"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={submitChild} disabled={pending || !childName.trim()}>
                  추가
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingParentId(null)}>
                  닫기
                </Button>
              </div>
            ) : null}
          </div>
        )}
      />
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="구분자 관리"
      description={`구분자를 ${SITE_MAIL_CATEGORY_MAX_DEPTH}단계까지 나눠 관리합니다. 이름을 누르면 수정, 드래그하면 같은 단계 안에서 순서가 바뀝니다`}
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="새 1단계 구분자명" htmlFor="new-cat-name" className="flex-1">
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

        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border pl-3">
          {renderLevel(null, 1)}
          {categories.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 구분자가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
