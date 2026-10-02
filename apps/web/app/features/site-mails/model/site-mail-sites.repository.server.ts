import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type { SiteMailSite } from "~/entities/site-mail/model/site-mail.types"

// 현장 메일함 전용 현장 목록. 대외기관 점검(/sites)의 sites 테이블과 완전히 분리돼 있어
// 여기서 추가·삭제해도 점검 현장/점검 기록에는 영향이 없다(20261001090000_separate_site_mail_sites.sql).
const TABLE_SITES = "site_mail_sites"
const TABLE_WRITERS = "site_mail_site_writers"
const TABLE_POSTS = "site_mail_posts"
const TABLE_ATTACHMENTS = "site_mail_attachments"
const BUCKET = "site-mails"

interface SiteRow {
  id: number
  name: string
  sort_order: number
}

async function listWriterIdsBySite(siteIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>()
  if (!siteIds.length) return result
  const { data, error } = await getSupabaseServerClient().from(TABLE_WRITERS).select("site_id, member_id").in("site_id", siteIds)
  if (error) throw new Error(`현장 담당자를 불러오지 못했습니다: ${error.message}`)
  for (const row of (data as { site_id: number; member_id: string }[]) ?? []) {
    result.set(row.site_id, [...(result.get(row.site_id) ?? []), row.member_id])
  }
  return result
}

export async function listSiteMailSites(): Promise<SiteMailSite[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_SITES)
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
  if (error) throw new Error(`현장 목록을 불러오지 못했습니다: ${error.message}`)

  const rows = (data as SiteRow[]) ?? []
  const writers = await listWriterIdsBySite(rows.map((row) => row.id))
  return rows.map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order, writerMemberIds: writers.get(row.id) ?? [] }))
}

export async function getSiteMailSiteById(id: number): Promise<SiteMailSite | null> {
  const { data, error } = await getSupabaseServerClient().from(TABLE_SITES).select("id, name, sort_order").eq("id", id).maybeSingle()
  if (error) throw new Error(`현장 정보를 불러오지 못했습니다: ${error.message}`)
  if (!data) return null
  const row = data as SiteRow
  const writers = await listWriterIdsBySite([row.id])
  return { id: row.id, name: row.name, sortOrder: row.sort_order, writerMemberIds: writers.get(row.id) ?? [] }
}

export async function createSiteMailSite(name: string): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE_SITES)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { error } = await supabase.from(TABLE_SITES).insert({ name: name.trim(), sort_order: nextOrder })
  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 현장명입니다.")
    throw new Error(`현장을 추가하지 못했습니다: ${error.message}`)
  }
}

export async function renameSiteMailSite(id: number, name: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE_SITES)
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 현장명입니다.")
    throw new Error(`현장 정보를 수정하지 못했습니다: ${error.message}`)
  }
}

export async function reorderSiteMailSites(items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase.from(TABLE_SITES).update({ sort_order: item.sortOrder }).eq("id", item.id)
    if (error) throw new Error(`현장 순서를 저장하지 못했습니다: ${error.message}`)
  }
}

// 메일함 현장을 삭제하면 그 현장의 메일·첨부파일도 함께 삭제된다(site_mail_posts on delete cascade).
// Storage 파일은 cascade 대상이 아니라서 먼저 지운다.
export async function deleteSiteMailSite(id: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: posts } = await supabase.from(TABLE_POSTS).select("id").eq("site_id", id)
  const postIds = ((posts as { id: string }[]) ?? []).map((row) => row.id)
  if (postIds.length) {
    const { data: attachments } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").in("post_id", postIds)
    const paths = ((attachments as { storage_path: string }[]) ?? []).map((row) => row.storage_path)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  }

  const { error } = await supabase.from(TABLE_SITES).delete().eq("id", id)
  if (error) throw new Error(`현장을 삭제하지 못했습니다: ${error.message}`)
}

// 담당자 목록을 통째로 교체한다.
export async function setSiteMailSiteWriters(siteId: number, memberIds: string[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { error: deleteError } = await supabase.from(TABLE_WRITERS).delete().eq("site_id", siteId)
  if (deleteError) throw new Error(`담당자를 저장하지 못했습니다: ${deleteError.message}`)

  const unique = [...new Set(memberIds)]
  if (!unique.length) return
  const { error } = await supabase.from(TABLE_WRITERS).insert(unique.map((memberId) => ({ site_id: siteId, member_id: memberId })))
  if (error) throw new Error(`담당자를 저장하지 못했습니다: ${error.message}`)
}
