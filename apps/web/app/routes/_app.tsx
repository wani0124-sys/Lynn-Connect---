import { useState } from "react"
import { Form, Link, NavLink, Outlet, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { Bell, ChevronDown, LogOut, Menu, PanelLeft, PanelLeftClose, Waypoints } from "lucide-react"
import { buildMenuTree } from "~/entities/sidebar-menu/lib/build-menu-tree"
import { sidebarMenuRouteIcon, type RenderNavNode } from "~/entities/sidebar-menu/model/sidebar-menu.types"
import { MEMBER_ROLE_LABEL } from "~/entities/member/model/member"
import { requireUser } from "~/features/auth/model/session.server"
import { listMenuItems } from "~/features/sidebar-menu/model/sidebar-menu.repository.server"
import { cn } from "~/shared/lib/cn"
import { navItems, secondaryNavItems } from "~/shared/config/nav"
import { useUiLayoutStore } from "~/shared/store/ui-layout.store"
import { Button } from "~/shared/ui/button"
import { Input } from "~/shared/ui/input"

// 정적 nav.ts 배열을 렌더 트리 모양으로 맞춘다(DB 조회 실패 시 fallback으로 사용).
function fromStaticNavItems(items: typeof navItems): RenderNavNode[] {
  return items.map((item) => ({ key: item.to, label: item.label, route: item.to, children: [] }))
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  if (user.mustChangePassword) throw redirect("/change-password")

  try {
    const menuItems = await listMenuItems()
    const tree = buildMenuTree(menuItems)
    const toRenderNodes = (nodes: typeof tree.primary): RenderNavNode[] =>
      nodes.map((node) => ({
        key: String(node.id),
        label: node.label,
        route: node.route,
        children: node.children.map((child) => ({
          key: String(child.id),
          label: child.label,
          route: child.route,
          children: [],
        })),
      }))
    return { user, primaryNav: toRenderNodes(tree.primary), secondaryNav: toRenderNodes(tree.secondary) }
  } catch (error) {
    console.error("사이드바 메뉴를 불러오지 못했습니다(마이그레이션 미적용 가능성), 기본 메뉴로 대체합니다:", error)
    return { user, primaryNav: fromStaticNavItems(navItems), secondaryNav: fromStaticNavItems(secondaryNavItems) }
  }
}

function Brand({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      title="대시보드로 이동"
      className="flex items-center gap-2.5 border-b border-primary-foreground/10 px-3 py-3 transition-colors hover:bg-primary-foreground/10"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-primary">
        <Waypoints className="size-5" aria-hidden />
      </div>
      {!collapsed ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-lg font-bold tracking-tight text-primary-foreground">Lynn-Connect</span>
          <span className="truncate text-xs text-primary-foreground/60">(린-커넥트)</span>
        </span>
      ) : null}
    </Link>
  )
}

function NavLinkRow({
  node,
  collapsed,
  onNavigate,
  indent,
}: {
  node: RenderNavNode
  collapsed?: boolean
  onNavigate?: () => void
  indent?: boolean
}) {
  const Icon = sidebarMenuRouteIcon(node.route)
  if (!node.route) return null
  return (
    <NavLink
      to={node.route}
      onClick={onNavigate}
      title={collapsed ? node.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
          indent ? "text-sm font-medium" : "text-lg font-bold",
          isActive
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
          collapsed && "justify-center px-0",
          indent && !collapsed && "pl-9",
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed ? <span className="truncate">{node.label}</span> : null}
    </NavLink>
  )
}

function NavGroupRow({
  node,
  collapsed,
  onNavigate,
  expanded,
  onToggle,
}: {
  node: RenderNavNode
  collapsed?: boolean
  onNavigate?: () => void
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = sidebarMenuRouteIcon(node.route)
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? node.label : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-lg font-bold text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{node.label}</span>
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
          </>
        ) : null}
      </button>
      {expanded && !collapsed ? (
        <div className="flex flex-col gap-1 pt-1">
          {node.children.map((child) => (
            <NavLinkRow key={child.key} node={child} onNavigate={onNavigate} indent />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NavList({
  items,
  collapsed,
  onNavigate,
  className,
  expandedGroups,
  onToggleGroup,
}: {
  items: RenderNavNode[]
  collapsed?: boolean
  onNavigate?: () => void
  className?: string
  expandedGroups: Set<string>
  onToggleGroup: (key: string) => void
}) {
  return (
    <nav className={cn("flex flex-col gap-1 p-2", className)}>
      {items.map((node) =>
        node.route === null ? (
          <NavGroupRow
            key={node.key}
            node={node}
            collapsed={collapsed}
            onNavigate={onNavigate}
            expanded={expandedGroups.has(node.key)}
            onToggle={() => onToggleGroup(node.key)}
          />
        ) : (
          <NavLinkRow key={node.key} node={node} collapsed={collapsed} onNavigate={onNavigate} />
        ),
      )}
    </nav>
  )
}

export default function AppLayout() {
  const { user, primaryNav, secondaryNav } = useLoaderData<typeof loader>()
  const sidebarCollapsed = useUiLayoutStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiLayoutStore((state) => state.toggleSidebar)
  const mobileNavOpen = useUiLayoutStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useUiLayoutStore((state) => state.setMobileNavOpen)
  // 그룹(하위 메뉴가 있는 항목)은 기본적으로 펼친 상태로 시작하고, 필요하면 접을 수 있게 한다.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set([...primaryNav, ...secondaryNav].filter((node) => node.route === null).map((node) => node.key)),
  )

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-primary bg-primary text-primary-foreground md:flex",
          sidebarCollapsed ? "w-16" : "w-72",
        )}
      >
        <Brand collapsed={sidebarCollapsed} />
        <NavList
          items={primaryNav}
          collapsed={sidebarCollapsed}
          className="flex-1 overflow-y-auto"
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
        />
        <NavList
          items={secondaryNav}
          collapsed={sidebarCollapsed}
          className="border-t border-primary-foreground/10"
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
        />
        <div className="border-t border-primary-foreground/10 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className={cn("w-full text-primary-foreground hover:bg-primary-foreground/10", sidebarCollapsed ? "justify-center px-0" : "justify-start")}
          >
            {sidebarCollapsed ? <PanelLeft aria-hidden /> : <PanelLeftClose aria-hidden />}
            {!sidebarCollapsed ? <span>접기</span> : null}
          </Button>
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-primary text-primary-foreground shadow-lg">
            <Brand onNavigate={() => setMobileNavOpen(false)} />
            <NavList
              items={primaryNav}
              onNavigate={() => setMobileNavOpen(false)}
              className="flex-1 overflow-y-auto"
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
            />
            <NavList
              items={secondaryNav}
              onNavigate={() => setMobileNavOpen(false)}
              className="border-t border-primary-foreground/10"
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu aria-hidden />
          </Button>

          <div className="hidden flex-1 sm:block">
            <Input placeholder="검색" className="max-w-sm" />
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Button variant="ghost" size="icon" aria-label="알림">
              <Bell aria-hidden />
            </Button>
            <div className="flex items-center gap-2 pl-1">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                aria-hidden
              >
                {user.name.slice(0, 1)}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{MEMBER_ROLE_LABEL[user.role]}</p>
              </div>
              <Form method="post" action="/logout">
                <Button type="submit" variant="ghost" size="icon" aria-label="로그아웃">
                  <LogOut aria-hidden />
                </Button>
              </Form>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
