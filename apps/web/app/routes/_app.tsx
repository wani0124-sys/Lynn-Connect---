import { Form, Link, NavLink, Outlet, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { Bell, LogOut, Menu, PanelLeft, PanelLeftClose, Waypoints } from "lucide-react"
import { MEMBER_ROLE_LABEL } from "~/entities/member/model/member"
import { requireUser } from "~/features/auth/model/session.server"
import { cn } from "~/shared/lib/cn"
import { navItems, secondaryNavItems, type NavItem } from "~/shared/config/nav"
import { useUiLayoutStore } from "~/shared/store/ui-layout.store"
import { Badge } from "~/shared/ui/badge"
import { Button } from "~/shared/ui/button"
import { Input } from "~/shared/ui/input"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  if (user.mustChangePassword) throw redirect("/change-password")
  return { user }
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

function NavList({
  items,
  collapsed,
  onNavigate,
  className,
}: {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
  className?: string
}) {
  return (
    <nav className={cn("flex flex-col gap-1 p-2", className)}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                collapsed && "justify-center px-0",
              )
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function AppLayout() {
  const { user } = useLoaderData<typeof loader>()
  const sidebarCollapsed = useUiLayoutStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiLayoutStore((state) => state.toggleSidebar)
  const mobileNavOpen = useUiLayoutStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useUiLayoutStore((state) => state.setMobileNavOpen)

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-primary bg-primary text-primary-foreground md:flex",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        <Brand collapsed={sidebarCollapsed} />
        <NavList items={navItems} collapsed={sidebarCollapsed} className="flex-1 overflow-y-auto" />
        <NavList items={secondaryNavItems} collapsed={sidebarCollapsed} className="border-t border-primary-foreground/10" />
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
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-primary text-primary-foreground shadow-lg">
            <Brand onNavigate={() => setMobileNavOpen(false)} />
            <NavList items={navItems} onNavigate={() => setMobileNavOpen(false)} className="flex-1 overflow-y-auto" />
            <NavList
              items={secondaryNavItems}
              onNavigate={() => setMobileNavOpen(false)}
              className="border-t border-primary-foreground/10"
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
            <Badge tone="warning">SCAFFOLD</Badge>
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
