import { ClipboardCheck, ClipboardList, FileText, Settings, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type SidebarMenuPlacement = "primary" | "secondary"

// 메뉴가 가리키는 실제 화면은 기존 5개로 고정한다. 새 라우트를 자유롭게 추가하지 않는다
// (2026-07-15 사용자 확인: 기존 5개 화면만 재배치/제목·순서 변경).
export const SIDEBAR_MENU_ROUTES = ["/standards", "/sites", "/documents", "/members", "/settings"] as const
export type SidebarMenuRoute = (typeof SIDEBAR_MENU_ROUTES)[number]

export const SIDEBAR_MENU_ROUTE_ICON: Record<SidebarMenuRoute, LucideIcon> = {
  "/standards": ClipboardList,
  "/sites": ClipboardCheck,
  "/documents": FileText,
  "/members": Users,
  "/settings": Settings,
}

// 그룹(상위 메뉴, route가 null인 항목)에 쓰는 기본 아이콘.
export const SIDEBAR_MENU_GROUP_ICON: LucideIcon = ClipboardList

export interface SidebarMenuItem {
  id: number
  label: string
  route: SidebarMenuRoute | null
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
  route: SidebarMenuRoute | null
  children: RenderNavNode[]
}
