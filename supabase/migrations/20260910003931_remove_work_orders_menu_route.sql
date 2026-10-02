-- "현장" 그룹 하위의 "작업지시서"(/work-orders) 스캐폴드 메뉴를 제거한다(2026-09-10 사용자 요청).
-- 화면 자체가 빈 스캐폴드였고 실제 기능(본사가 현장에 작업 지시를 발령하는 구조)은 구현되지 않아
-- 메뉴/라우트를 통째로 되돌린다. 고정 화면 목록을 6개 -> 5개로 되돌리되,
-- 20260716120000에서 추가한 커스텀 "/menu/<8자리 hex>" 리프 허용은 그대로 유지한다.

delete from public.sidebar_menu_items where route = '/work-orders';

alter table public.sidebar_menu_items drop constraint if exists sidebar_menu_items_route_check;
alter table public.sidebar_menu_items add constraint sidebar_menu_items_route_check
  check (
    route is null
    or route in ('/standards', '/sites', '/documents', '/members', '/settings')
    or route ~ '^/menu/[0-9a-f]{8}$'
  );
