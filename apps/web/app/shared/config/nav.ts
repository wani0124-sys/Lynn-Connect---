import { ClipboardCheck, ClipboardList, FileText, Package, Settings, Users } from "lucide-react"
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
  { to: "/documents", label: "문서 관리", icon: FileText },
  { to: "/items", label: "항목 관리", icon: Package },
  { to: "/members", label: "구성원", icon: Users },
  { to: "/settings", label: "설정", icon: Settings },
]
