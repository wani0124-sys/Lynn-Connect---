import { useEffect, useState } from "react"
import type { Member } from "~/entities/member/model/member"
import type { Site } from "~/entities/site/model/site.types"
import { Button } from "~/shared/ui/button"
import { Checkbox } from "~/shared/ui/checkbox"
import { Modal } from "~/shared/ui/modal"

export interface SitePermissionModalProps {
  open: boolean
  onClose: () => void
  member: Member | null
  sites: Site[]
  pending?: boolean
  onSubmit: (managedSiteIds: number[] | null) => void
}

export function SitePermissionModal({ open, onClose, member, sites, pending, onSubmit }: SitePermissionModalProps) {
  const [allSites, setAllSites] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open || !member) return
    setAllSites(member.managedSiteIds === null)
    setSelectedIds(new Set(member.managedSiteIds ?? []))
  }, [open, member])

  function toggleSite(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    onSubmit(allSites ? null : [...selectedIds])
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="관리 현장 권한 수정"
      description={member ? `${member.name} 계정이 열람·관리할 수 있는 현장을 설정합니다` : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={allSites} onChange={(e) => setAllSites(e.target.checked)} />
          전체 현장 관리
        </label>

        <div className="divide-y divide-border rounded-md border border-border">
          {sites.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">등록된 현장이 없습니다.</p>
          ) : (
            sites.map((site) => (
              <label
                key={site.id}
                className="flex items-center gap-2 p-3 text-sm aria-disabled:opacity-50"
                aria-disabled={allSites}
              >
                <Checkbox checked={allSites || selectedIds.has(site.id)} disabled={allSites} onChange={() => toggleSite(site.id)} />
                {site.name}
              </label>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
