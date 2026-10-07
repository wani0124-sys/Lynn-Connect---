import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import { getCategoryDepth, getCategoryWithDescendantIds } from "~/entities/site-mail/lib/category-tree"
import { SITE_MAIL_CATEGORY_MAX_DEPTH, type SiteMailCategory } from "~/entities/site-mail/model/site-mail.types"

// 현장 메일함 전용 구분자 목록. 부서별 업무기준(standard_categories)과 분리돼 있고(20261002090000),
// 메일함 현장마다 각자의 목록을 갖는다(20261002120000) — 한 현장에서 바꿔도 다른 현장·본사에는 영향이 없다.
// 최대 3단계로 나뉜다(20261007090000, parent_id). 이름 중복은 같은 상위 구분자 안에서만 막는다.
// 수정·삭제·순서 변경은 모두 site_id로 한 번 더 좁혀서, 다른 현장의 구분자 id가 섞여 들어와도 건드리지 않는다.
const TABLE_CATEGORIES = "site_mail_categories"
const TABLE_POSTS = "site_mail_posts"

interface CategoryRow {
  id: number
  name: string
  color: string
  sort_order: number
  parent_id: number | null
}

const CATEGORY_COLUMNS = "id, name, color, sort_order, parent_id"

function toCategory(row: CategoryRow): SiteMailCategory {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order, parentId: row.parent_id }
}

export async function listSiteMailCategories(siteId: number): Promise<SiteMailCategory[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .select(CATEGORY_COLUMNS)
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`구분자 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as CategoryRow[]).map(toCategory)
}

// 여러 현장의 구분자를 한 번에 불러온다(업로드 화면에서 현장 선택에 따라 목록을 바꿔 보여줄 때).
export async function listSiteMailCategoriesBySite(siteIds: number[]): Promise<Record<number, SiteMailCategory[]>> {
  const result: Record<number, SiteMailCategory[]> = {}
  if (!siteIds.length) return result
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .select(`site_id, ${CATEGORY_COLUMNS}`)
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

// parentId가 있으면 그 구분자의 하위로 만든다. 상위 구분자는 같은 현장 소속이어야 하고, 3단계 아래로는 만들 수 없다.
export async function createSiteMailCategory(
  siteId: number,
  name: string,
  color: string,
  parentId: number | null = null,
): Promise<void> {
  const supabase = getSupabaseServerClient()
  if (parentId !== null) {
    const categories = await listSiteMailCategories(siteId)
    if (!categories.some((cat) => cat.id === parentId)) throw new Error("이 현장의 구분자가 아닙니다.")
    if (getCategoryDepth(categories, parentId) >= SITE_MAIL_CATEGORY_MAX_DEPTH) {
      throw new Error(`구분자는 ${SITE_MAIL_CATEGORY_MAX_DEPTH}단계까지만 만들 수 있습니다.`)
    }
  }

  let maxQuery = supabase.from(TABLE_CATEGORIES).select("sort_order").eq("site_id", siteId)
  maxQuery = parentId === null ? maxQuery.is("parent_id", null) : maxQuery.eq("parent_id", parentId)
  const { data: maxRow } = await maxQuery.order("sort_order", { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 10

  const { error } = await supabase
    .from(TABLE_CATEGORIES)
    .insert({ site_id: siteId, parent_id: parentId, name: name.trim(), color: color || "#6b7280", sort_order: nextOrder })

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

// 하위 구분자도 함께 지워진다(parent_id on delete cascade). 지워지는 구분자들에 붙은 메일은 "없음"으로 돌린다.
export async function deleteSiteMailCategory(siteId: number, id: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  const removedIds = getCategoryWithDescendantIds(await listSiteMailCategories(siteId), id)
  const { error: unassignError } = await supabase
    .from(TABLE_POSTS)
    .update({ category_id: null })
    .eq("site_id", siteId)
    .in("category_id", removedIds)
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
