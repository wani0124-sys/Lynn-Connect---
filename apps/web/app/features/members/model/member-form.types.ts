import type { CreatableMemberRole, MenuPermission } from "~/entities/member/model/member"

export interface MemberFormValues {
  name: string
  email: string
  role: CreatableMemberRole
  position: string
  department: string
  menuPermission: MenuPermission
  // 현장관리자일 때만 사용. 본사관리자는 항상 모든 현장을 관리한다.
  // 두 현장 메뉴의 현장 목록은 서로 독립적이라(대외기관 점검 sites / 현장별 메일함 site_mail_sites) 따로 고른다.
  // 현장관리자는 둘 중 하나 이상을 골라야 한다.
  siteId: number | null
  mailSiteId: number | null
}
