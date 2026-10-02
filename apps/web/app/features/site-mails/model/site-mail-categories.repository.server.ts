import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type { StandardCategory } from "~/entities/task-standard/model/task-standard.types"

// 현장 메일함 전용 구분자 목록. 부서별 업무기준(standard_categories)과 분리돼 있고(20261002090000),
// 메일함 현장마다 각자의 목록을 갖는다(20261002120000) — 한 현장에서 바꿔도 다른 현장·본사에는 영향이 없다.
// 모양(id/name/color/sortOrder)은 본사 구분자와 같으므로 StandardCategory 타입과 CategoryBadge 등 UI를 그대로 재사용한다.
// 수정·삭제·순서 변경은 모두 site_id로 한 번 더 좁혀서, 다른 현장의 구분자 id가 섞여 들어와도 건드리지 않는다.
const TABLE_CATEGORIES = "site_mail_categories"
const TABLE_POSTS = "site_mail_posts"

interface CategoryRow {
  id: number
  name: string
  color: string
  sort_order: number
}

function toCategory(row: CategoryRow): StandardCategory {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order }
}

export async function listSiteMailCategories(siteId: number): Promise<StandardCategory[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .select("id, name, color, sort_order")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`구분자 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as CategoryRow[]).map(toCategory)
}

// 여러 현장의 구분자를 한 번에 불러온다(업로드 화면에서 현장 선택에 따라 목록을 바꿔 보여줄 때).
export async function listSiteMailCategoriesBySite(siteIds: number[]): Promise<Record<number, StandardCategory[]>> {
  const result: Record<number, StandardCategory[]> = {}
  if (!siteIds.length) return result
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .select("id, site_id, name, color, sort_order")
    .in("site_id", siteIds)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`구분자 목록을 불러오지 못했습니다: ${error.message}`)
  for (const row of (data as (CategoryRow & { site_id: number })[]) ?? []) {
    ;(result[row.site_id] ??= []).push(toCategory(row))
  }
  return result
}

// 메일에 붙이려는 구분자가 그 메일의 현장 소속인지 확인한다(null은 "없음"이라 통과).
export async function assertSiteMailCategory(siteId: number, categoryId: number | null): Promise<void> {
  if (categoryId === null) return
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .select("id")
    .eq("id", categoryId)
    .eq("site_id", siteId)
    .maybeSingle()
  if (error) throw new Error(`구분자를 확인하지 못했습니다: ${error.message}`)
  if (!data) throw new Error("이 현장의 구분자가 아닙니다.")
}

export async function createSiteMailCategory(siteId: number, name: string, color: string): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE_CATEGORIES)
    .select("sort_order")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 10

  const { error } = await supabase
    .from(TABLE_CATEGORIES)
    .insert({ site_id: siteId, name: name.trim(), color: color || "#6b7280", sort_order: nextOrder })

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 구분자입니다.")
    throw new Error(`구분자를 추가하지 못했습니다: ${error.message}`)
  }
}

export async function renameSiteMailCategory(siteId: number, id: number, name: string, color: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .update({ name: name.trim(), color })
    .eq("id", id)
    .eq("site_id", siteId)

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 구분자입니다.")
    throw new Error(`구분자를 수정하지 못했습니다: ${error.message}`)
  }
}

export async function deleteSiteMailCategory(siteId: number, id: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { error: unassignError } = await supabase
    .from(TABLE_POSTS)
    .update({ category_id: null })
    .eq("site_id", siteId)
    .eq("category_id", id)
  if (unassignError) throw new Error(`게시글의 구분자 정보를 정리하지 못했습니다: ${unassignError.message}`)

  const { error } = await supabase.from(TABLE_CATEGORIES).delete().eq("id", id).eq("site_id", siteId)
  if (error) throw new Error(`구분자를 삭제하지 못했습니다: ${error.message}`)
}

export async function reorderSiteMailCategories(siteId: number, items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase
      .from(TABLE_CATEGORIES)
      .update({ sort_order: item.sortOrder })
      .eq("id", item.id)
      .eq("site_id", siteId)
    if (error) throw new Error(`구분자 순서를 저장하지 못했습니다: ${error.message}`)
  }
}
