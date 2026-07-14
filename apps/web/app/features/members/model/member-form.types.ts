import type { CreatableMemberRole, MenuPermission } from "~/entities/member/model/member"

export interface MemberFormValues {
  name: string
  email: string
  role: CreatableMemberRole
  position: string
  department: string
  menuPermission: MenuPermission
  // 현장관리자일 때만 사용. 본사관리자는 항상 모든 현장을 관리한다.
  siteId: number | null
}
