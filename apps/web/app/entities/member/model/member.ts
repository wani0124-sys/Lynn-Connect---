export type MemberRole = "admin" | "manager" | "member"
export type MemberStatus = "active" | "invited" | "suspended"
export type MenuPermission = "all" | "limited"

export interface Member {
  id: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  // 현장(member) 계정이 소속된 현장. 본사(admin/manager) 계정은 null이다. 계정 1개 = 현장 1곳.
  siteId: number | null
  position: string | null
  department: string | null
  // 열람 가능한 메뉴 범위. all이면 전체 메뉴, limited면 배정된 현장 관련 메뉴만.
  menuPermission: MenuPermission
  // 관리 현장 권한(관리 현장 권한 탭에서 편집). null이면 전체 현장.
  managedSiteIds: number[] | null
  joinedAt: string
  // true면 로그인은 되지만 비밀번호부터 바꿔야 한다(계정 생성 시 강제 임시 비밀번호 발급).
  mustChangePassword: boolean
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

export const MENU_PERMISSION_LABEL: Record<MenuPermission, string> = {
  all: "전체",
  limited: "제한",
}

// 본사(쓰기 권한) vs 현장(자기 현장만 쓰기 권한) 구분. 메일 아카이브 등 본사/현장 권한이 분리되는 도메인에서 재사용한다.
export const HEADQUARTERS_ROLES: MemberRole[] = ["admin", "manager"]

export function isHeadquarters(role: MemberRole): boolean {
  return HEADQUARTERS_ROLES.includes(role)
}

// 멤버 관리 화면에서 쓰는 2단계 구분자. role 자체는 admin/manager/member 3단계를 유지하되
// 화면에는 본사관리자(admin+manager) / 현장관리자(member)로 묶어서 보여준다.
export type MemberGroup = "headquarters" | "site"

export function getMemberGroup(role: MemberRole): MemberGroup {
  return isHeadquarters(role) ? "headquarters" : "site"
}

export const MEMBER_GROUP_LABEL: Record<MemberGroup, string> = {
  headquarters: "본사관리자",
  site: "현장관리자",
}

export const MEMBER_GROUP_TONE: Record<MemberGroup, "primary" | "info"> = {
  headquarters: "primary",
  site: "info",
}

// 신규 계정 생성 시 화면에서 선택하는 역할은 2단계뿐이다. 본사관리자는 manager로,
// 최초 시드 admin 계정(전체 최고관리자)은 화면에서 새로 만들 수 없다.
export type CreatableMemberRole = Extract<MemberRole, "manager" | "member">

export const CREATABLE_MEMBER_ROLE_OPTIONS: { value: CreatableMemberRole; label: string }[] = [
  { value: "manager", label: MEMBER_GROUP_LABEL.headquarters },
  { value: "member", label: MEMBER_GROUP_LABEL.site },
]

// 현장 점검(site_inspections) 같은 "현장이 직접 작성하는" 도메인의 쓰기 권한 판정.
// 본사는 모든 현장에 쓸 수 있고, 현장 계정은 자신이 소속된 현장에만 쓸 수 있다.
// 본사/현장 모두 다른 현장 자료는 항상 열람 가능하다(읽기는 requireUser만으로 이미 허용됨).
export function canWriteSite(user: Member, siteId: number): boolean {
  return isHeadquarters(user.role) || user.siteId === siteId
}

// 데모 시드 계정. 실제로는 DB에서 관리하며 "멤버 관리" 페이지에서 추가·수정한다.
// 비밀번호는 여기에 두지 않는다(클라이언트 번들 노출 금지).
// 데모 자격증명은 features/auth/model/credentials.server.ts 에 서버 전용으로 둔다.
// member@woomi.dev의 siteId=1은 "현장 관리"에서 처음 만드는 현장의 id(신규 sites 테이블은 1부터 시작)와
// 맞아떨어지도록 임시로 지정했다. 실제로 다른 현장을 먼저 만들면 구성원 화면에서 재배정해야 한다.
export const seedMembers: Member[] = [
  {
    id: "USR-001",
    name: "관리자",
    email: "admin@woomi.dev",
    role: "admin",
    status: "active",
    siteId: null,
    position: "대표",
    department: "경영지원팀",
    menuPermission: "all",
    managedSiteIds: null,
    joinedAt: "2026-01-05",
    mustChangePassword: false,
  },
  {
    id: "USR-002",
    name: "이도현",
    email: "manager@woomi.dev",
    role: "manager",
    status: "active",
    siteId: null,
    position: "팀장",
    department: "건축기획팀",
    menuPermission: "all",
    managedSiteIds: null,
    joinedAt: "2026-02-10",
    mustChangePassword: false,
  },
  {
    id: "USR-003",
    name: "박서준",
    email: "member@woomi.dev",
    role: "member",
    status: "active",
    siteId: 1,
    position: "과장",
    department: "현장관리팀",
    menuPermission: "limited",
    managedSiteIds: [1],
    joinedAt: "2026-03-02",
    mustChangePassword: false,
  },
  {
    id: "USR-004",
    name: "최유나",
    email: "yuna@woomi.dev",
    role: "member",
    status: "invited",
    siteId: null,
    position: "대리",
    department: "현장관리팀",
    menuPermission: "limited",
    managedSiteIds: [],
    joinedAt: "2026-04-18",
    mustChangePassword: true,
  },
  {
    id: "USR-005",
    name: "정민재",
    email: "minjae@woomi.dev",
    role: "manager",
    status: "suspended",
    siteId: null,
    position: "부장",
    department: "건축기획팀",
    menuPermission: "all",
    managedSiteIds: null,
    joinedAt: "2026-01-20",
    mustChangePassword: false,
  },
  {
    id: "USR-006",
    name: "한지우",
    email: "jiwoo@woomi.dev",
    role: "member",
    status: "invited",
    siteId: null,
    position: "사원",
    department: "현장관리팀",
    menuPermission: "limited",
    managedSiteIds: [],
    joinedAt: "2026-05-30",
    mustChangePassword: true,
  },
]

export function findMemberById(id: string): Member | undefined {
  return seedMembers.find((member) => member.id === id)
}

export function findMemberByEmail(email: string): Member | undefined {
  const normalized = email.trim().toLowerCase()
  return seedMembers.find((member) => member.email.toLowerCase() === normalized)
}

// 아래 함수들은 데모 인메모리 저장소(seedMembers)를 직접 변형한다.
// 서버 프로세스가 살아있는 동안에만 유지되며, 재시작하면 초기 시드로 되돌아간다.
export function addMember(member: Member): void {
  seedMembers.push(member)
}

export function updateMember(id: string, patch: Partial<Omit<Member, "id">>): Member | null {
  const member = seedMembers.find((m) => m.id === id)
  if (!member) return null
  Object.assign(member, patch)
  return member
}

export function removeMember(id: string): void {
  const index = seedMembers.findIndex((m) => m.id === id)
  if (index !== -1) seedMembers.splice(index, 1)
}

export function nextMemberId(): string {
  const max = seedMembers.reduce((acc, m) => {
    const n = Number(m.id.replace("USR-", ""))
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return `USR-${String(max + 1).padStart(3, "0")}`
}
