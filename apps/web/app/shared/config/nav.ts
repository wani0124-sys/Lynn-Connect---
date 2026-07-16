import { ClipboardCheck, ClipboardEdit, ClipboardList, FileText, Settings, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

// 대시보드는 이 목록이 아니라 사이드바 상단 로고(Brand)에서 바로 이동한다.
export const navItems: NavItem[] = [
  { to: "/standards", label: "부서별 업무기준 (메일공지)", icon: ClipboardList },
  { to: "/sites", label: "현장 점검", icon: ClipboardCheck },
  { to: "/work-orders", label: "작업지시서", icon: ClipboardEdit },
  { to: "/documents", label: "문서 관리", icon: FileText },
]

// 사이드바 하단에 별도로 배치하는 관리성 메뉴.
export const secondaryNavItems: NavItem[] = [
  { to: "/members", label: "멤버 관리", icon: Users },
  { to: "/settings", label: "설정", icon: Settings },
]
