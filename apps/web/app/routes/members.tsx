import { useEffect, useMemo, useState } from "react"
import { data, useFetcher, useLoaderData, useSearchParams, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react"
import {
  MEMBER_GROUP_LABEL,
  MEMBER_GROUP_TONE,
  MENU_PERMISSION_LABEL,
  addMember,
  findMemberByEmail,
  findMemberById,
  getMemberGroup,
  isHeadquarters,
  nextMemberId,
  removeMember,
  seedMembers,
  updateMember,
  type CreatableMemberRole,
  type Member,
  type MemberGroup,
  type MenuPermission,
} from "~/entities/member/model/member"
import type { Site } from "~/entities/site/model/site.types"
import { generateTempPassword, setPassword } from "~/features/auth/model/credentials.server"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import { listSites } from "~/features/sites/model/sites.repository.server"
import { formatManagedSites } from "~/features/members/lib/format-managed-sites"
import type { BulkCreateRow } from "~/features/members/ui/member-bulk-create-modal"
import { MemberBulkCreateModal } from "~/features/members/ui/member-bulk-create-modal"
import { MemberCreatedModal, type CreatedAccount } from "~/features/members/ui/member-created-modal"
import { MemberFormModal } from "~/features/members/ui/member-form-modal"
import type { MemberFormValues } from "~/features/members/model/member-form.types"
import { SitePermissionModal } from "~/features/members/ui/site-permission-modal"
import { formatDate } from "~/shared/lib/format"
import { Badge } from "~/shared/ui/badge"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { Checkbox } from "~/shared/ui/checkbox"
import { EmptyState } from "~/shared/ui/empty-state"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { PageHeader } from "~/shared/ui/page-header"
import { Select } from "~/shared/ui/select"
import { Tabs } from "~/shared/ui/tabs"
import { TBody, TD, TH, THead, TR, Table } from "~/shared/ui/table"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  let sites: Site[] = []
  try {
    sites = await listSites()
  } catch (error) {
    console.error("현장 목록을 불러오지 못했습니다:", error)
  }
  return { members: seedMembers, currentUserId: user.id, sites, canManage: isHeadquarters(user.role) }
}

function computeManagedSiteIds(existing: Member, role: CreatableMemberRole, siteId: number | null): number[] | null {
  if (role !== "member") return null
  if (existing.managedSiteIds === null) return existing.managedSiteIds
  if (siteId !== null && !existing.managedSiteIds.includes(siteId)) return [...existing.managedSiteIds, siteId]
  return existing.managedSiteIds
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireHeadquarters(request)
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "member.create": {
        const name = String(form.get("name") ?? "").trim()
        const email = String(form.get("email") ?? "").trim()
        const role = String(form.get("role") ?? "member") as CreatableMemberRole
        const position = String(form.get("position") ?? "").trim() || null
        const department = String(form.get("department") ?? "").trim() || null
        const menuPermission = String(form.get("menuPermission") ?? "limited") as MenuPermission
        const siteIdRaw = form.get("siteId")
        const siteId = siteIdRaw ? Number(siteIdRaw) : null

        if (!name || !email) return data({ error: "이름과 이메일을 입력하세요." }, { status: 400 })
        if (role === "member" && siteId === null) return data({ error: "소속 현장을 선택하세요." }, { status: 400 })
        if (findMemberByEmail(email)) return data({ error: "이미 등록된 이메일입니다." }, { status: 400 })

        const tempPassword = generateTempPassword()
        addMember({
          id: nextMemberId(),
          name,
          email,
          role,
          status: "invited",
          siteId: role === "member" ? siteId : null,
          position,
          department,
          menuPermission,
          managedSiteIds: role === "member" ? (siteId !== null ? [siteId] : []) : null,
          joinedAt: new Date().toISOString().slice(0, 10),
          mustChangePassword: true,
        })
        setPassword(email, tempPassword)

        return { ok: true as const, created: [{ name, email, tempPassword }] }
      }
      case "member.bulkCreate": {
        const role = String(form.get("role") ?? "member") as CreatableMemberRole
        const siteIdRaw = form.get("siteId")
        const siteId = siteIdRaw ? Number(siteIdRaw) : null
        const rows = JSON.parse(String(form.get("rows") ?? "[]")) as { name: string; email: string }[]

        if (role === "member" && siteId === null) return data({ error: "소속 현장을 선택하세요." }, { status: 400 })

        const created: CreatedAccount[] = []
        const seenEmails = new Set<string>()
        for (const row of rows) {
          const name = row.name?.trim() ?? ""
          const email = row.email?.trim() ?? ""
          if (!name || !email) continue
          const normalized = email.toLowerCase()
          if (seenEmails.has(normalized) || findMemberByEmail(email)) continue
          seenEmails.add(normalized)

          const tempPassword = generateTempPassword()
          addMember({
            id: nextMemberId(),
            name,
            email,
            role,
            status: "invited",
            siteId: role === "member" ? siteId : null,
            position: null,
            department: null,
            menuPermission: role === "manager" ? "all" : "limited",
            managedSiteIds: role === "member" ? (siteId !== null ? [siteId] : []) : null,
            joinedAt: new Date().toISOString().slice(0, 10),
            mustChangePassword: true,
          })
          setPassword(email, tempPassword)
          created.push({ name, email, tempPassword })
        }

        if (created.length === 0) {
          return data({ error: "생성할 수 있는 계정이 없습니다. 이메일 중복을 확인하세요." }, { status: 400 })
        }
        return { ok: true as const, created }
      }
      case "member.update": {
        const id = String(form.get("id") ?? "")
        const existing = findMemberById(id)
        if (!existing) return data({ error: "존재하지 않는 계정입니다." }, { status: 400 })

        const name = String(form.get("name") ?? "").trim()
        const role = String(form.get("role") ?? "member") as CreatableMemberRole
        const position = String(form.get("position") ?? "").trim() || null
        const department = String(form.get("department") ?? "").trim() || null
        const menuPermission = String(form.get("menuPermission") ?? "limited") as MenuPermission
        const siteIdRaw = form.get("siteId")
        const siteId = siteIdRaw ? Number(siteIdRaw) : null

        if (!name) return data({ error: "이름을 입력하세요." }, { status: 400 })
        if (role === "member" && siteId === null) return data({ error: "소속 현장을 선택하세요." }, { status: 400 })

        updateMember(id, {
          name,
          role,
          position,
          department,
          menuPermission,
          siteId: role === "member" ? siteId : null,
          managedSiteIds: computeManagedSiteIds(existing, role, siteId),
        })
        return { ok: true as const }
      }
      case "member.delete": {
        const id = String(form.get("id") ?? "")
        if (id === user.id) return data({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 400 })
        removeMember(id)
        return { ok: true as const }
      }
      case "member.bulkDelete": {
        const ids = JSON.parse(String(form.get("ids") ?? "[]")) as string[]
        for (const id of ids) {
          if (id === user.id) continue
          removeMember(id)
        }
        return { ok: true as const }
      }
      case "member.updateSitePermission": {
        const id = String(form.get("id") ?? "")
        const raw = String(form.get("managedSiteIds") ?? "null")
        const managedSiteIds = raw === "null" ? null : (JSON.parse(raw) as number[])
        updateMember(id, { managedSiteIds })
        return { ok: true as const }
      }
      default:
        return data({ error: "알 수 없는 요청입니다." }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
    return data({ error: message }, { status: 400 })
  }
}

export default function MembersRoute() {
  const { members, currentUserId, sites, canManage } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") === "site-permissions" ? "site-permissions" : "members"

  const [query, setQuery] = useState("")
  const [siteFilter, setSiteFilter] = useState("")
  const [groupFilter, setGroupFilter] = useState<"" | MemberGroup>("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [permissionTarget, setPermissionTarget] = useState<Member | null>(null)
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[] | null>(null)

  const formFetcher = useFetcher<typeof action>()
  const bulkFetcher = useFetcher<typeof action>()
  const permissionFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()

  const formError = formFetcher.data && "error" in formFetcher.data ? formFetcher.data.error : null
  const bulkError = bulkFetcher.data && "error" in bulkFetcher.data ? bulkFetcher.data.error : null

  useEffect(() => {
    if (formFetcher.state === "idle" && formFetcher.data && "ok" in formFetcher.data && formFetcher.data.ok) {
      setFormModalOpen(false)
      setEditingMember(null)
      if ("created" in formFetcher.data && formFetcher.data.created) setCreatedAccounts(formFetcher.data.created)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formFetcher.state, formFetcher.data])

  useEffect(() => {
    if (bulkFetcher.state === "idle" && bulkFetcher.data && "ok" in bulkFetcher.data && bulkFetcher.data.ok) {
      setBulkModalOpen(false)
      if ("created" in bulkFetcher.data && bulkFetcher.data.created) setCreatedAccounts(bulkFetcher.data.created)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkFetcher.state, bulkFetcher.data])

  useEffect(() => {
    if (permissionFetcher.state === "idle" && permissionFetcher.data && "ok" in permissionFetcher.data && permissionFetcher.data.ok) {
      setPermissionTarget(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionFetcher.state, permissionFetcher.data])

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data && "ok" in deleteFetcher.data && deleteFetcher.data.ok) {
      setDeletingMember(null)
      setSelectedIds(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteFetcher.state, deleteFetcher.data])

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    const siteId = siteFilter ? Number(siteFilter) : null
    return members.filter((member) => {
      if (q && !member.name.toLowerCase().includes(q) && !member.email.toLowerCase().includes(q)) return false
      if (groupFilter && getMemberGroup(member.role) !== groupFilter) return false
      if (siteId !== null) {
        const managesSite = member.managedSiteIds === null || member.managedSiteIds.includes(siteId) || member.siteId === siteId
        if (!managesSite) return false
      }
      return true
    })
  }, [members, query, siteFilter, groupFilter])

  function setTab(next: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === "members") params.delete("tab")
      else params.set("tab", next)
      return params
    })
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === filteredMembers.length ? new Set() : new Set(filteredMembers.map((m) => m.id)),
    )
  }

  function openCreate() {
    setEditingMember(null)
    setFormModalOpen(true)
  }

  function openEdit(member: Member) {
    setEditingMember(member)
    setFormModalOpen(true)
  }

  function handleFormSubmit(values: MemberFormValues) {
    formFetcher.submit(
      {
        intent: editingMember ? "member.update" : "member.create",
        ...(editingMember ? { id: editingMember.id } : { email: values.email }),
        name: values.name,
        role: values.role,
        position: values.position,
        department: values.department,
        menuPermission: values.menuPermission,
        siteId: values.siteId !== null ? String(values.siteId) : "",
      },
      { method: "post" },
    )
  }

  function handleBulkSubmit(rows: BulkCreateRow[], role: CreatableMemberRole, siteId: number | null) {
    bulkFetcher.submit(
      { intent: "member.bulkCreate", role, siteId: siteId !== null ? String(siteId) : "", rows: JSON.stringify(rows) },
      { method: "post" },
    )
  }

  function handleDelete() {
    if (!deletingMember) return
    deleteFetcher.submit({ intent: "member.delete", id: deletingMember.id }, { method: "post" })
  }

  function deleteSelected() {
    deleteFetcher.submit({ intent: "member.bulkDelete", ids: JSON.stringify([...selectedIds]) }, { method: "post" })
  }

  function handlePermissionSubmit(managedSiteIds: number[] | null) {
    if (!permissionTarget) return
    permissionFetcher.submit(
      {
        intent: "member.updateSitePermission",
        id: permissionTarget.id,
        managedSiteIds: managedSiteIds === null ? "null" : JSON.stringify(managedSiteIds),
      },
      { method: "post" },
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="멤버 관리"
        description="본사관리자·현장관리자 계정과 관리 현장 권한을 관리합니다"
        actions={
          canManage ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">총 {members.length}명</span>
              <Button variant="outline" onClick={() => setBulkModalOpen(true)}>
                <UsersRound className="size-4" aria-hidden />
                일괄 생성
              </Button>
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                계정 생성
              </Button>
            </>
          ) : null
        }
      />

      <Tabs
        items={[
          { value: "members", label: "멤버 관리" },
          { value: "site-permissions", label: "관리 현장 권한" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 이메일로 검색..."
              className="pl-9"
              aria-label="검색"
            />
          </div>
          <Select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} aria-label="현장 필터">
            <option value="">전체 현장</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          {tab === "members" ? (
            <Select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as "" | MemberGroup)}
              aria-label="역할 필터"
            >
              <option value="">전체 역할</option>
              <option value="headquarters">{MEMBER_GROUP_LABEL.headquarters}</option>
              <option value="site">{MEMBER_GROUP_LABEL.site}</option>
            </Select>
          ) : null}
        </div>

        {canManage && tab === "members" && selectedIds.size > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-md bg-danger/5 px-3 py-2">
            <p className="text-sm text-foreground">{selectedIds.size}명 선택됨</p>
            <Button variant="danger" size="sm" onClick={deleteSelected} disabled={deleteFetcher.state !== "idle"}>
              <Trash2 className="size-4" aria-hidden />
              선택 삭제
            </Button>
          </div>
        ) : null}

        <div className="mt-4">
          {filteredMembers.length === 0 ? (
            <EmptyState title="조건에 맞는 멤버가 없습니다" description="검색어나 필터를 변경해보세요." />
          ) : tab === "members" ? (
            <Table>
              <THead>
                <TR>
                  {canManage ? (
                    <TH className="w-10">
                      <Checkbox
                        checked={selectedIds.size === filteredMembers.length}
                        onChange={toggleAll}
                        aria-label="전체 선택"
                      />
                    </TH>
                  ) : null}
                  <TH>이름</TH>
                  <TH>이메일</TH>
                  <TH>역할</TH>
                  <TH>메뉴 권한</TH>
                  <TH>직위 / 부서</TH>
                  <TH>관리 현장</TH>
                  {canManage ? <TH className="text-right">액션</TH> : null}
                </TR>
              </THead>
              <TBody>
                {filteredMembers.map((member) => {
                  const group = getMemberGroup(member.role)
                  return (
                    <TR key={member.id}>
                      {canManage ? (
                        <TD>
                          <Checkbox checked={selectedIds.has(member.id)} onChange={() => toggleOne(member.id)} aria-label="선택" />
                        </TD>
                      ) : null}
                      <TD>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                            aria-hidden
                          >
                            {member.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {member.name}
                              {member.id === currentUserId ? (
                                <Badge tone="primary" className="ml-1.5">
                                  나
                                </Badge>
                              ) : null}
                              {member.mustChangePassword ? (
                                <Badge tone="warning" className="ml-1.5">
                                  비밀번호 변경 대기
                                </Badge>
                              ) : null}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(member.joinedAt)}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-muted-foreground">{member.email}</TD>
                      <TD>
                        <Badge tone={MEMBER_GROUP_TONE[group]}>{MEMBER_GROUP_LABEL[group]}</Badge>
                      </TD>
                      <TD className="text-sm text-muted-foreground">{MENU_PERMISSION_LABEL[member.menuPermission]}</TD>
                      <TD>
                        <p className="text-sm">{member.position ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{member.department ?? "-"}</p>
                      </TD>
                      <TD className="text-sm text-muted-foreground">{formatManagedSites(member.managedSiteIds, sites)}</TD>
                      {canManage ? (
                        <TD className="text-right">
                          <Button variant="ghost" size="icon" aria-label="수정" onClick={() => openEdit(member)}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="삭제"
                            onClick={() => setDeletingMember(member)}
                            disabled={member.id === currentUserId}
                          >
                            <Trash2 className="size-4 text-danger" aria-hidden />
                          </Button>
                        </TD>
                      ) : null}
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>이름</TH>
                  <TH>이메일</TH>
                  <TH>역할</TH>
                  <TH>관리 현장</TH>
                  {canManage ? <TH className="text-right">액션</TH> : null}
                </TR>
              </THead>
              <TBody>
                {filteredMembers.map((member) => {
                  const group = getMemberGroup(member.role)
                  return (
                    <TR key={member.id}>
                      <TD className="font-medium">{member.name}</TD>
                      <TD className="text-muted-foreground">{member.email}</TD>
                      <TD>
                        <Badge tone={MEMBER_GROUP_TONE[group]}>{MEMBER_GROUP_LABEL[group]}</Badge>
                      </TD>
                      <TD className="text-sm text-muted-foreground">{formatManagedSites(member.managedSiteIds, sites)}</TD>
                      {canManage ? (
                        <TD className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setPermissionTarget(member)}>
                            수정
                          </Button>
                        </TD>
                      ) : null}
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </div>
      </Card>

      {canManage ? (
        <MemberFormModal
          open={formModalOpen}
          onClose={() => {
            setFormModalOpen(false)
            setEditingMember(null)
          }}
          sites={sites}
          editingMember={editingMember}
          pending={formFetcher.state !== "idle"}
          error={formError}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {canManage ? (
        <MemberBulkCreateModal
          open={bulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          sites={sites}
          pending={bulkFetcher.state !== "idle"}
          error={bulkError}
          onSubmit={handleBulkSubmit}
        />
      ) : null}

      <MemberCreatedModal open={createdAccounts !== null} onClose={() => setCreatedAccounts(null)} accounts={createdAccounts ?? []} />

      {canManage ? (
        <SitePermissionModal
          open={permissionTarget !== null}
          onClose={() => setPermissionTarget(null)}
          member={permissionTarget}
          sites={sites}
          pending={permissionFetcher.state !== "idle"}
          onSubmit={handlePermissionSubmit}
        />
      ) : null}

      {canManage ? (
        <Modal
          open={deletingMember !== null}
          onClose={() => setDeletingMember(null)}
          title="계정 삭제"
          description={deletingMember ? `${deletingMember.name}(${deletingMember.email}) 계정을 삭제할까요? 되돌릴 수 없습니다.` : undefined}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeletingMember(null)} disabled={deleteFetcher.state !== "idle"}>
                취소
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteFetcher.state !== "idle"}>
                {deleteFetcher.state !== "idle" ? "삭제 중…" : "삭제"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">삭제된 계정은 로그인할 수 없습니다.</p>
        </Modal>
      ) : null}
    </div>
  )
}
