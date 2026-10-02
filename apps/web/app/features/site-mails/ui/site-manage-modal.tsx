import { useState } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import type { SiteMailSite } from "~/entities/site-mail/model/site-mail.types"
import { Button } from "~/shared/ui/button"
import { Checkbox } from "~/shared/ui/checkbox"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { DragHandle, SortableList } from "~/shared/ui/sortable-list"

export interface SiteMailWriterCandidate {
  id: string
  name: string
  email: string
}

export interface SiteMailSiteManageModalProps {
  open: boolean
  onClose: () => void
  sites: SiteMailSite[]
  // 담당자로 지정할 수 있는 현장 계정 목록(본사 계정은 지정 없이도 항상 쓰기 가능하므로 제외).
  writerCandidates: SiteMailWriterCandidate[]
  pending: boolean
  onCreate: (name: string) => void
  onRename: (id: number, name: string) => void
  onDelete: (id: number) => void
  onReorder: (items: { id: number; sortOrder: number }[]) => void
  onSetWriters: (id: number, memberIds: string[]) => void
}

// features/sites/ui/site-manage-modal.tsx와 같은 구조이되, 메일함 전용 현장 목록(site_mail_sites)을 다루고
// 주소 대신 현장별 담당자(쓰기 권한 계정) 지정이 있다. 삭제 시 그 현장의 메일이 모두 지워지므로 확인을 거친다.
export function SiteMailSiteManageModal({
  open,
  onClose,
  sites,
  writerCandidates,
  pending,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onSetWriters,
}: SiteMailSiteManageModalProps) {
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [writersSiteId, setWritersSiteId] = useState<number | null>(null)
  const [writersDraft, setWritersDraft] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const sorted = [...sites].sort((a, b) => a.sortOrder - b.sortOrder)
  const candidateNameById = new Map(writerCandidates.map((member) => [member.id, member.name]))

  function submitCreate() {
    if (!name.trim()) return
    onCreate(name.trim())
    setName("")
  }

  function submitEdit() {
    if (editingId === null || !editingName.trim()) return
    onRename(editingId, editingName.trim())
    setEditingId(null)
  }

  function openWriters(site: SiteMailSite) {
    setEditingId(null)
    setConfirmDeleteId(null)
    setWritersSiteId(site.id)
    setWritersDraft(new Set(site.writerMemberIds))
  }

  function toggleWriter(memberId: string) {
    setWritersDraft((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  function saveWriters() {
    if (writersSiteId === null) return
    onSetWriters(writersSiteId, [...writersDraft])
    setWritersSiteId(null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="현장 관리"
      description="메일함 전용 현장 목록입니다. 대외기관 점검의 현장과는 연동되지 않습니다."
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field label="현장명" htmlFor="new-site-mail-site-name" className="flex-1">
            <Input
              id="new-site-mail-site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitCreate()
                }
              }}
              placeholder="예: 부산장안"
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
            onReorder={(items) => onReorder(items.map((site, index) => ({ id: site.id, sortOrder: index })))}
            renderItem={(site, drag) => {
              if (editingId === site.id) {
                return (
                  <div className="flex items-center gap-2 p-3">
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1" autoFocus />
                    <Button type="button" size="sm" onClick={submitEdit} disabled={pending}>
                      저장
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                  </div>
                )
              }

              const writerNames = site.writerMemberIds.map((id) => candidateNameById.get(id)).filter(Boolean)
              return (
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <DragHandle {...drag} />
                      <button
                        type="button"
                        onClick={() => {
                          setWritersSiteId(null)
                          setConfirmDeleteId(null)
                          setEditingId(site.id)
                          setEditingName(site.name)
                        }}
                        className="min-w-0 text-left hover:underline"
                      >
                        <span className="block truncate text-sm font-medium">{site.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          담당자: {writerNames.length ? writerNames.join(", ") : "없음(본사만 작성 가능)"}
                        </span>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openWriters(site)} disabled={pending}>
                        <Users className="size-4" aria-hidden />
                        담당자
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setWritersSiteId(null)
                          setConfirmDeleteId(site.id)
                        }}
                        disabled={pending}
                        aria-label="삭제"
                      >
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {writersSiteId === site.id ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                      <p className="text-sm font-medium">이 현장 메일을 올리고 수정할 수 있는 현장 계정</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">본사 계정은 지정하지 않아도 항상 작성할 수 있습니다.</p>
                      {writerCandidates.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">등록된 현장 계정이 없습니다. 멤버 관리에서 먼저 추가하세요.</p>
                      ) : (
                        <div className="mt-3 grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
                          {writerCandidates.map((member) => (
                            <label key={member.id} className="flex min-w-0 items-center gap-2 text-sm">
                              <Checkbox checked={writersDraft.has(member.id)} onChange={() => toggleWriter(member.id)} />
                              <span className="truncate">
                                {member.name} <span className="text-xs text-muted-foreground">{member.email}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <Button type="button" size="sm" onClick={saveWriters} disabled={pending}>
                          저장
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setWritersSiteId(null)}>
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {confirmDeleteId === site.id ? (
                    <ConfirmPanel
                      className="mt-3"
                      title={`"${site.name}" 현장을 삭제할까요?`}
                      description="이 현장에 올라온 메일과 첨부파일이 모두 함께 삭제되며 되돌릴 수 없습니다. 대외기관 점검의 현장에는 영향이 없습니다."
                      pending={pending}
                      onConfirm={() => {
                        onDelete(site.id)
                        setConfirmDeleteId(null)
                      }}
                      onCancel={() => setConfirmDeleteId(null)}
                    />
                  ) : null}
                </div>
              )
            }}
          />
          {sorted.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 현장이 없습니다.</p> : null}
        </div>
      </div>
    </Modal>
  )
}
