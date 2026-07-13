import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { Site } from "~/entities/site/model/site.types"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { DragHandle, SortableList } from "~/shared/ui/sortable-list"

export interface SiteManageModalProps {
  open: boolean
  onClose: () => void
  sites: Site[]
  pending: boolean
  onCreate: (name: string, address: string) => void
  onRename: (id: number, name: string, address: string) => void
  onDelete: (id: number) => void
  onReorder: (items: { id: number; sortOrder: number }[]) => void
}

export function SiteManageModal({ open, onClose, sites, pending, onCreate, onRename, onDelete, onReorder }: SiteManageModalProps) {
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingAddress, setEditingAddress] = useState("")

  const sorted = [...sites].sort((a, b) => a.sortOrder - b.sortOrder)

  function startEdit(site: Site) {
    setEditingId(site.id)
    setEditingName(site.name)
    setEditingAddress(site.address ?? "")
  }

  function submitCreate() {
    if (!name.trim()) return
    onCreate(name.trim(), address.trim())
    setName("")
    setAddress("")
  }

  function submitEdit() {
    if (editingId === null || !editingName.trim()) return
    onRename(editingId, editingName.trim(), editingAddress.trim())
    setEditingId(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="현장 관리" description="현장을 추가·수정·삭제하고 드래그해서 순서를 변경합니다">
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="현장명" htmlFor="new-site-name" className="flex-1">
            <Input id="new-site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 부산장안 공동주택 신축공사" />
          </Field>
          <Field label="주소 (선택)" htmlFor="new-site-address" className="flex-1">
            <Input id="new-site-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="현장 주소" />
          </Field>
          <Button type="button" onClick={submitCreate} disabled={pending || !name.trim()}>
            <Plus className="size-4" aria-hidden />
            추가
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          <SortableList
            items={sorted}
            onReorder={(items) => onReorder(items.map((site, index) => ({ id: site.id, sortOrder: index })))}
            renderItem={(site, drag) =>
              editingId === site.id ? (
                <div className="flex items-center gap-2 p-3">
                  <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1" autoFocus />
                  <Input
                    value={editingAddress}
                    onChange={(e) => setEditingAddress(e.target.value)}
                    className="flex-1"
                    placeholder="현장 주소"
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
                    <button type="button" onClick={() => startEdit(site)} className="min-w-0 text-left hover:underline">
                      <span className="block truncate text-sm font-medium">{site.name}</span>
                      {site.address ? <span className="block truncate text-xs text-muted-foreground">{site.address}</span> : null}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(site.id)}
                    disabled={pending}
                    aria-label="삭제"
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              )
            }
          />
          {sorted.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 현장이 없습니다.</p> : null}
        </div>
      </div>
    </Modal>
  )
}
