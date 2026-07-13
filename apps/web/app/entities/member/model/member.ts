export type MemberRole = "admin" | "manager" | "member"
export type MemberStatus = "active" | "invited" | "suspended"

export interface Member {
  id: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
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

// 본사(쓰기 권한) vs 현장(읽기 전용) 구분. 메일 아카이브 등 본사/현장 권한이 분리되는 도메인에서 재사용한다.
export const HEADQUARTERS_ROLES: MemberRole[] = ["admin", "manager"]

export function isHeadquarters(role: MemberRole): boolean {
  return HEADQUARTERS_ROLES.includes(role)
}

// 데모 시드 계정. 실제로는 DB에서 관리하며 "구성원" 페이지에서 추가·수정한다.
// 비밀번호는 여기에 두지 않는다(클라이언트 번들 노출 금지).
// 데모 자격증명은 features/auth/model/credentials.server.ts 에 서버 전용으로 둔다.
export const seedMembers: Member[] = [
  { id: "USR-001", name: "관리자", email: "admin@woomi.dev", role: "admin", status: "active" },
  { id: "USR-002", name: "이도현", email: "manager@woomi.dev", role: "manager", status: "active" },
  { id: "USR-003", name: "박서준", email: "member@woomi.dev", role: "member", status: "active" },
  { id: "USR-004", name: "최유나", email: "yuna@woomi.dev", role: "member", status: "invited" },
  { id: "USR-005", name: "정민재", email: "minjae@woomi.dev", role: "manager", status: "suspended" },
  { id: "USR-006", name: "한지우", email: "jiwoo@woomi.dev", role: "member", status: "invited" },
]

export function findMemberById(id: string): Member | undefined {
  return seedMembers.find((member) => member.id === id)
}

export function findMemberByEmail(email: string): Member | undefined {
  const normalized = email.trim().toLowerCase()
  return seedMembers.find((member) => member.email.toLowerCase() === normalized)
}
