export type MemberRole = "admin" | "manager" | "member"
export type MemberStatus = "active" | "invited" | "suspended"

export interface Member {
  id: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  // 현장(member) 계정이 소속된 현장. 본사(admin/manager) 계정은 null이다. 계정 1개 = 현장 1곳.
  siteId: number | null
}

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  admin: "관리자",
  manager: "매니저",
  member: "구성원",
}

export const MEMBER_ROLE_TONE: Record<MemberRole, "primary" | "info" | "neutral"> = {
  admin: "primary",
  manager: "info",
  member: "neutral",
}

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: "활성",
  invited: "초대됨",
  suspended: "정지",
}

export const MEMBER_STATUS_TONE: Record<MemberStatus, "success" | "warning" | "danger"> = {
  active: "success",
  invited: "warning",
  suspended: "danger",
}

// 본사(쓰기 권한) vs 현장(자기 현장만 쓰기 권한) 구분. 메일 아카이브 등 본사/현장 권한이 분리되는 도메인에서 재사용한다.
export const HEADQUARTERS_ROLES: MemberRole[] = ["admin", "manager"]

export function isHeadquarters(role: MemberRole): boolean {
  return HEADQUARTERS_ROLES.includes(role)
}

// 현장 점검(site_inspections) 같은 "현장이 직접 작성하는" 도메인의 쓰기 권한 판정.
// 본사는 모든 현장에 쓸 수 있고, 현장 계정은 자신이 소속된 현장에만 쓸 수 있다.
// 본사/현장 모두 다른 현장 자료는 항상 열람 가능하다(읽기는 requireUser만으로 이미 허용됨).
export function canWriteSite(user: Member, siteId: number): boolean {
  return isHeadquarters(user.role) || user.siteId === siteId
}

// 데모 시드 계정. 실제로는 DB에서 관리하며 "구성원" 페이지에서 추가·수정한다.
// 비밀번호는 여기에 두지 않는다(클라이언트 번들 노출 금지).
// 데모 자격증명은 features/auth/model/credentials.server.ts 에 서버 전용으로 둔다.
// member@woomi.dev의 siteId=1은 "현장 관리"에서 처음 만드는 현장의 id(신규 sites 테이블은 1부터 시작)와
// 맞아떨어지도록 임시로 지정했다. 실제로 다른 현장을 먼저 만들면 구성원 화면에서 재배정해야 한다.
export const seedMembers: Member[] = [
  { id: "USR-001", name: "관리자", email: "admin@woomi.dev", role: "admin", status: "active", siteId: null },
  { id: "USR-002", name: "이도현", email: "manager@woomi.dev", role: "manager", status: "active", siteId: null },
  { id: "USR-003", name: "박서준", email: "member@woomi.dev", role: "member", status: "active", siteId: 1 },
  { id: "USR-004", name: "최유나", email: "yuna@woomi.dev", role: "member", status: "invited", siteId: null },
  { id: "USR-005", name: "정민재", email: "minjae@woomi.dev", role: "manager", status: "suspended", siteId: null },
  { id: "USR-006", name: "한지우", email: "jiwoo@woomi.dev", role: "member", status: "invited", siteId: null },
]

export function findMemberById(id: string): Member | undefined {
  return seedMembers.find((member) => member.id === id)
}

export function findMemberByEmail(email: string): Member | undefined {
  const normalized = email.trim().toLowerCase()
  return seedMembers.find((member) => member.email.toLowerCase() === normalized)
}
