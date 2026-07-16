import { randomUUID } from "node:crypto"
import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type { SidebarMenuItem, SidebarMenuPlacement } from "~/entities/sidebar-menu/model/sidebar-menu.types"

const TABLE = "sidebar_menu_items"

interface MenuItemRow {
  id: number
  label: string
  route: string | null
  parent_id: number | null
  placement: SidebarMenuPlacement
  sort_order: number
}

function toMenuItem(row: MenuItemRow): SidebarMenuItem {
  return {
    id: row.id,
    label: row.label,
    route: row.route,
    parentId: row.parent_id,
    placement: row.placement,
    sortOrder: row.sort_order,
  }
}

export async function listMenuItems(): Promise<SidebarMenuItem[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .select("id, label, route, parent_id, placement, sort_order")
    .order("sort_order", { ascending: true })
  if (error) throw new Error(`사이드바 메뉴를 불러오지 못했습니다: ${error.message}`)
  return (data as MenuItemRow[]).map(toMenuItem)
}

export async function renameMenuItem(id: number, label: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE)
    .update({ label, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(`메뉴 제목을 수정하지 못했습니다: ${error.message}`)
}

export async function createMenuGroup(label: string, placement: SidebarMenuPlacement): Promise<SidebarMenuItem> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE)
    .select("sort_order")
    .is("parent_id", null)
    .eq("placement", placement)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ label, route: null, parent_id: null, placement, sort_order: nextOrder })
    .select("id, label, route, parent_id, placement, sort_order")
    .single()
  if (error) throw new Error(`그룹을 추가하지 못했습니다: ${error.message}`)
  return toMenuItem(data as MenuItemRow)
}

// 그룹 삭제 시 하위 메뉴는 on delete set null(migration)로 자동으로 최상위로 승격된다.
// 리프 메뉴(고정 6개 화면)는 그룹이 아니라서 이 함수로 삭제할 수 없다(호출 전 route === null 확인 필요).
export async function deleteMenuGroup(id: number): Promise<void> {
  const { error } = await getSupabaseServerClient().from(TABLE).delete().eq("id", id).is("route", null)
  if (error) throw new Error(`그룹을 삭제하지 못했습니다: ${error.message}`)
}

// 관리자가 메뉴 관리 화면에서 즉석으로 만드는, 아직 실제 화면이 없는 하위 메뉴("/menu/<slug>").
// 그룹(parentId) 아래에만 만들 수 있다(2단계 고정 트리거가 최상위 그룹 여부/placement 일치를 함께 검증한다).
export async function createMenuLeaf(label: string, parentId: number, placement: SidebarMenuPlacement): Promise<SidebarMenuItem> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE)
    .select("sort_order")
    .eq("parent_id", parentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? -1) + 1
  const route = `/menu/${randomUUID().split("-")[0]}`

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ label, route, parent_id: parentId, placement, sort_order: nextOrder })
    .select("id, label, route, parent_id, placement, sort_order")
    .single()
  if (error) throw new Error(`하위 메뉴를 추가하지 못했습니다: ${error.message}`)
  return toMenuItem(data as MenuItemRow)
}

// 관리자가 만든 커스텀 하위 메뉴만 삭제할 수 있다(route가 "/menu/"로 시작하는 항목).
// 고정 6개 화면 리프는 이 조건에 걸리지 않아 실수로 지워지지 않는다.
export async function deleteCustomMenuLeaf(id: number): Promise<void> {
  const { error } = await getSupabaseServerClient().from(TABLE).delete().eq("id", id).like("route", "/menu/%")
  if (error) throw new Error(`하위 메뉴를 삭제하지 못했습니다: ${error.message}`)
}

// 커스텀 하위 메뉴 화면(menu-placeholder.tsx)이 route로 자기 자신의 라벨을 찾을 때 쓴다.
export async function findMenuItemByRoute(route: string): Promise<SidebarMenuItem | null> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE)
    .select("id, label, route, parent_id, placement, sort_order")
    .eq("route", route)
    .maybeSingle()
  if (error) throw new Error(`메뉴 정보를 불러오지 못했습니다: ${error.message}`)
  return data ? toMenuItem(data as MenuItemRow) : null
}

// 항목을 그룹 하위로 옮기거나(parentId 지정) 최상위로 승격(parentId null)한다.
// 하위로 옮길 때는 그룹의 placement를 그대로 물려받는다(DB 트리거가 불일치 시 거부한다).
export async function setMenuItemParent(id: number, parentId: number | null): Promise<void> {
  const supabase = getSupabaseServerClient()
  let placement: SidebarMenuPlacement | undefined
  if (parentId !== null) {
    const { data: parentRow, error: parentError } = await supabase
      .from(TABLE)
      .select("placement")
      .eq("id", parentId)
      .maybeSingle()
    if (parentError) throw new Error(`상위 메뉴 정보를 불러오지 못했습니다: ${parentError.message}`)
    if (!parentRow) throw new Error("존재하지 않는 상위 메뉴입니다.")
    placement = parentRow.placement
  }

  const { error } = await supabase
    .from(TABLE)
    .update({ parent_id: parentId, ...(placement ? { placement } : {}), updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(`메뉴를 이동하지 못했습니다: ${error.message}`)
}

// 최상위 항목의 placement(사이드바 상단/하단 배치)를 바꾼다. 하위 메뉴가 있으면 함께 옮긴다
// (DB 트리거가 상위-하위 placement 불일치를 거부하기 때문).
export async function setTopLevelMenuItemPlacement(id: number, placement: SidebarMenuPlacement): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: children, error: childError } = await supabase.from(TABLE).select("id").eq("parent_id", id)
  if (childError) throw new Error(`하위 메뉴 정보를 불러오지 못했습니다: ${childError.message}`)

  for (const child of (children as { id: number }[]) ?? []) {
    const { error } = await supabase
      .from(TABLE)
      .update({ placement, updated_at: new Date().toISOString() })
      .eq("id", child.id)
    if (error) throw new Error(`하위 메뉴 배치를 변경하지 못했습니다: ${error.message}`)
  }

  const { error } = await supabase
    .from(TABLE)
    .update({ placement, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(`메뉴 배치를 변경하지 못했습니다: ${error.message}`)
}

export async function reorderMenuItems(items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase.from(TABLE).update({ sort_order: item.sortOrder }).eq("id", item.id)
    if (error) throw new Error(`메뉴 순서를 저장하지 못했습니다: ${error.message}`)
  }
}
