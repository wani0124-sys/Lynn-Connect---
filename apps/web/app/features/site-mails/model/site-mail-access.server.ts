import { redirect } from "react-router"
import { isHeadquarters, type Member } from "~/entities/member/model/member"
import type { SiteMailSite } from "~/entities/site-mail/model/site-mail.types"
import { requireUser } from "~/features/auth/model/session.server"
import { getSiteMailSiteById } from "./site-mail-sites.repository.server"

// 현장 메일함 쓰기 권한: 본사(admin/manager)는 모든 현장, 현장 계정은 담당자로 지정된 메일함 현장만.
// 대외기관 점검의 canWriteSite(members.site_id 기준)와는 별개다.
export function canWriteSiteMail(user: Member, site: Pick<SiteMailSite, "writerMemberIds">): boolean {
  return isHeadquarters(user.role) || site.writerMemberIds.includes(user.id)
}

// 현장 메일함 열람 권한: 쓰기와 같은 기준(2026-10-02 사용자 요청 "현장은 본인 현장만 볼 수 있게").
// 본사는 모든 현장, 현장 계정은 담당자로 지정된 메일함 현장만 목록·상세·첨부를 볼 수 있다.
export function canViewSiteMail(user: Member, site: Pick<SiteMailSite, "writerMemberIds">): boolean {
  return canWriteSiteMail(user, site)
}

// 다른 현장 메일의 id/첨부 id를 직접 입력해 들어오는 경우를 막는다.
export async function requireSiteMailReadAccess(request: Request, siteId: number): Promise<Member> {
  const user = await requireUser(request)
  const site = await getSiteMailSiteById(siteId)
  if (!site || !canViewSiteMail(user, site)) throw redirect("/forbidden")
  return user
}

export async function requireSiteMailWriteAccess(request: Request, siteId: number): Promise<{ user: Member; site: SiteMailSite }> {
  const user = await requireUser(request)
  const site = await getSiteMailSiteById(siteId)
  if (!site || !canWriteSiteMail(user, site)) throw redirect("/forbidden")
  return { user, site }
}
