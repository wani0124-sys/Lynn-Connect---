import { useRouteLoaderData } from "react-router"
import type { RenderNavNode } from "~/entities/sidebar-menu/model/sidebar-menu.types"

// 사이드바 트리(primaryNav/secondaryNav)에서 특정 route가 가리키는 메뉴의 현재 라벨을 찾는다.
function findMenuLabel(nodes: RenderNavNode[], targetRoute: string): string | undefined {
  for (const node of nodes) {
    if (node.route === targetRoute) return node.label
    const found = findMenuLabel(node.children, targetRoute)
    if (found) return found
  }
  return undefined
}

interface AppLayoutData {
  primaryNav: RenderNavNode[]
  secondaryNav: RenderNavNode[]
}

// 사이드바 메뉴 관리 탭(설정 화면)에서 바꾼 라벨을 각 화면 PageHeader 제목에도 동일하게 반영한다.
// _app.tsx(id: "app-layout")의 loader 데이터를 아직 못 읽는 경우(마이그레이션 미적용 등)엔 fallback을 그대로 쓴다.
export function usePageMenuTitle(route: string, fallback: string): string {
  const appData = useRouteLoaderData<AppLayoutData>("app-layout")
  if (!appData) return fallback
  return findMenuLabel([...appData.primaryNav, ...appData.secondaryNav], route) ?? fallback
}
