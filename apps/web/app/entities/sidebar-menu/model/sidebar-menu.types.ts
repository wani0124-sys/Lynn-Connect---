import { ClipboardCheck, ClipboardEdit, ClipboardList, FileQuestion, FileText, Settings, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type SidebarMenuPlacement = "primary" | "secondary"

// 실제 화면이 있는 고정 라우트 목록(아이콘 매핑 용도). 새 화면을 만들 때 이 배열과 DB의
// sidebar_menu_items_route_check 제약을 함께 갱신한다
// (2026-07-15 사용자 확인: 기존 5개 화면만 재배치/제목·순서 변경 → 2026-07-16 "/work-orders" 추가로 6개).
// 이와 별개로 관리자는 메뉴 관리 화면에서 아직 실제 화면이 없는 "/menu/:slug" 커스텀 하위 메뉴도 만들 수 있다
// (`sidebarMenuRouteIcon`가 고정 목록에 없는 route는 기본 아이콘으로 대체한다).
export const SIDEBAR_MENU_ROUTES = ["/standards", "/sites", "/documents", "/members", "/settings", "/work-orders"] as const
export type SidebarMenuRoute = (typeof SIDEBAR_MENU_ROUTES)[number]

export const SIDEBAR_MENU_ROUTE_ICON: Record<SidebarMenuRoute, LucideIcon> = {
  "/standards": ClipboardList,
  "/sites": ClipboardCheck,
  "/documents": FileText,
  "/members": Users,
  "/settings": Settings,
  "/work-orders": ClipboardEdit,
}

// 그룹(상위 메뉴, route가 null인 항목)에 쓰는 기본 아이콘.
export const SIDEBAR_MENU_GROUP_ICON: LucideIcon = ClipboardList

// 아직 실제 화면이 연결되지 않은 커스텀 하위 메뉴("/menu/:slug")에 쓰는 기본 아이콘.
export const SIDEBAR_MENU_CUSTOM_ROUTE_ICON: LucideIcon = FileQuestion

export function sidebarMenuRouteIcon(route: string | null): LucideIcon {
  if (route === null) return SIDEBAR_MENU_GROUP_ICON
  return (SIDEBAR_MENU_ROUTE_ICON as Record<string, LucideIcon>)[route] ?? SIDEBAR_MENU_CUSTOM_ROUTE_ICON
}

export interface SidebarMenuItem {
  id: number
  label: string
  route: string | null
  parentId: number | null
  placement: SidebarMenuPlacement
  sortOrder: number
}

export interface SidebarMenuNode extends SidebarMenuItem {
  children: SidebarMenuItem[]
}

// _app.tsx의 loader가 클라이언트로 직렬화해 내려주는 렌더용 트리 노드(아이콘 컴포넌트 대신 route 문자열만 담는다).
// 각 화면의 PageHeader 제목을 사이드바 메뉴 라벨과 동기화할 때도 이 타입을 함께 사용한다.
export interface RenderNavNode {
  key: string
  label: string
  route: string | null
  children: RenderNavNode[]
}
