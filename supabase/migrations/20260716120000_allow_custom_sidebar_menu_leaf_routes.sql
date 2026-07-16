-- 관리자가 메뉴 관리 화면(/settings)에서 실제 화면 없이도 하위 메뉴를 즉석으로 만들 수 있게 한다
-- (2026-07-16 사용자 확인: "상위 메뉴를 만들면 그 아래로 하위 메뉴를 만들 수 있게 해달라").
-- 이런 커스텀 메뉴는 "/menu/<8자리 hex slug>" 형태의 route를 쓰고, 실제 화면은 아직 없어
-- apps/web/app/routes/menu-placeholder.tsx가 공통 "준비 중" 화면을 보여준다.
-- 고정 6개 화면(route_check에 나열된 값)은 여전히 코드/마이그레이션으로만 추가한다.

alter table public.sidebar_menu_items drop constraint if exists sidebar_menu_items_route_check;
alter table public.sidebar_menu_items add constraint sidebar_menu_items_route_check
  check (
    route is null
    or route in ('/standards', '/sites', '/documents', '/members', '/settings', '/work-orders')
    or route ~ '^/menu/[0-9a-f]{8}$'
  );
