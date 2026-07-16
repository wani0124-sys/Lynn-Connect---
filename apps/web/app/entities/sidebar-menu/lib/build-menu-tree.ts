import type { SidebarMenuItem, SidebarMenuNode, SidebarMenuPlacement } from "~/entities/sidebar-menu/model/sidebar-menu.types"

// 평면 목록(sort_order 순 정렬 안 된 상태 포함)을 placement별 2단계 트리로 조립한다.
// 사이드바 렌더링(_app.tsx)과 메뉴 관리 화면(settings.tsx)이 동일한 트리 규칙을 공유한다.
export function buildMenuTree(items: SidebarMenuItem[]): Record<SidebarMenuPlacement, SidebarMenuNode[]> {
  const byParent = new Map<number, SidebarMenuItem[]>()
  for (const item of items) {
    if (item.parentId === null) continue
    const list = byParent.get(item.parentId) ?? []
    list.push(item)
    byParent.set(item.parentId, list)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)

  const roots = items.filter((item) => item.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder)

  const tree: Record<SidebarMenuPlacement, SidebarMenuNode[]> = { primary: [], secondary: [] }
  for (const root of roots) {
    tree[root.placement].push({ ...root, children: byParent.get(root.id) ?? [] })
  }
  return tree
}
