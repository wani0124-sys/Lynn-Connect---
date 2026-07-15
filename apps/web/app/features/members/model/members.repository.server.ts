import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type { Member, MemberRole, MemberStatus, MenuPermission } from "~/entities/member/model/member"

const TABLE = "members"

const SELECT_COLUMNS =
  "id, name, email, role, status, site_id, position, department, menu_permission, managed_site_ids, joined_at, must_change_password"

interface MemberRow {
  id: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  site_id: number | null
  position: string | null
  department: string | null
  menu_permission: MenuPermission
  managed_site_ids: number[] | null
  joined_at: string
  must_change_password: boolean
}

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    siteId: row.site_id,
    position: row.position,
    department: row.department,
    menuPermission: row.menu_permission,
    managedSiteIds: row.managed_site_ids,
    joinedAt: row.joined_at,
    mustChangePassword: row.must_change_password,
  }
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .order("joined_at", { ascending: true })
  if (error) throw new Error(`멤버 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as MemberRow[]).map(toMember)
}

export async function getMemberById(id: string): Promise<Member | null> {
  const { data, error } = await getSupabaseServerClient().from(TABLE).select(SELECT_COLUMNS).eq("id", id).maybeSingle()
  if (error) throw new Error(`멤버 정보를 불러오지 못했습니다: ${error.message}`)
  return data ? toMember(data as MemberRow) : null
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .ilike("email", email.trim())
    .maybeSingle()
  if (error) throw new Error(`멤버 정보를 불러오지 못했습니다: ${error.message}`)
  return data ? toMember(data as MemberRow) : null
}

interface CreateMemberInput {
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  siteId: number | null
  position: string | null
  department: string | null
  menuPermission: MenuPermission
  managedSiteIds: number[] | null
  passwordHash: string
  joinedAt: string
  mustChangePassword: boolean
}

export async function createMember(input: CreateMemberInput): Promise<Member> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .insert({
      name: input.name,
      email: input.email,
      role: input.role,
      status: input.status,
      site_id: input.siteId,
      position: input.position,
      department: input.department,
      menu_permission: input.menuPermission,
      managed_site_ids: input.managedSiteIds,
      password_hash: input.passwordHash,
      joined_at: input.joinedAt,
      must_change_password: input.mustChangePassword,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) {
    if (error.code === "23505") throw new Error("이미 등록된 이메일입니다.")
    throw new Error(`계정을 생성하지 못했습니다: ${error.message}`)
  }
  return toMember(data as MemberRow)
}

export async function updateMember(id: string, patch: Partial<Omit<Member, "id">>): Promise<Member | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = patch.name
  if (patch.email !== undefined) update.email = patch.email
  if (patch.role !== undefined) update.role = patch.role
  if (patch.status !== undefined) update.status = patch.status
  if (patch.siteId !== undefined) update.site_id = patch.siteId
  if (patch.position !== undefined) update.position = patch.position
  if (patch.department !== undefined) update.department = patch.department
  if (patch.menuPermission !== undefined) update.menu_permission = patch.menuPermission
  if (patch.managedSiteIds !== undefined) update.managed_site_ids = patch.managedSiteIds
  if (patch.joinedAt !== undefined) update.joined_at = patch.joinedAt
  if (patch.mustChangePassword !== undefined) update.must_change_password = patch.mustChangePassword

  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(`계정 정보를 수정하지 못했습니다: ${error.message}`)
  return data ? toMember(data as MemberRow) : null
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await getSupabaseServerClient().from(TABLE).delete().eq("id", id)
  if (error) throw new Error(`계정을 삭제하지 못했습니다: ${error.message}`)
}

// ── 인증 전용 ────────────────────────────────────────────────
// password_hash는 목록/상세 조회(SELECT_COLUMNS)에 포함하지 않고 로그인/비밀번호 변경 경로에서만 조회한다.
export async function getMemberCredentialsByEmail(
  email: string,
): Promise<{ id: string; status: MemberStatus; passwordHash: string } | null> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .select("id, status, password_hash")
    .ilike("email", email.trim())
    .maybeSingle()
  if (error) throw new Error(`계정 정보를 불러오지 못했습니다: ${error.message}`)
  if (!data) return null
  return { id: data.id, status: data.status, passwordHash: data.password_hash }
}

export async function setMemberPasswordHash(email: string, passwordHash: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE)
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .ilike("email", email.trim())
  if (error) throw new Error(`비밀번호를 저장하지 못했습니다: ${error.message}`)
}
