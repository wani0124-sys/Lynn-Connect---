import type { Member } from "~/entities/member/model/member"

// 현장 마스터가 관리(수정·삭제)할 수 있는 계정인지 판정한다. 서버 action과 화면 버튼 노출에 같이 쓴다.
// 대상은 같은 현장 소속 일반 현장 계정뿐이다. 본사 계정, 다른 마스터, 본인 계정은 본사관리자만 바꿀 수 있다.
// "같은 현장"은 대외기관 점검 현장(site_id)이 같거나, 담당 메일함 현장이 하나라도 겹치는 경우다.
export function canSiteMasterManage(
  master: Member,
  masterMailSiteIds: number[],
  target: Member,
  targetMailSiteIds: number[],
): boolean {
  if (target.role !== "member" || target.isSiteMaster || target.id === master.id) return false
  if (master.siteId !== null && target.siteId === master.siteId) return true
  return targetMailSiteIds.some((id) => masterMailSiteIds.includes(id))
}
