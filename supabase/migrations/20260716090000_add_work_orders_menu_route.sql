-- 사이드바 메뉴가 가리킬 수 있는 고정 화면을 5개 -> 6개로 확장한다: "/work-orders"(작업지시서) 추가.
-- 화면 자체는 이번에는 스캐폴드(빈 화면)만 만들고, 실제 기능(본사가 특정 현장에 작업 지시를 발령하는 구조)은
-- 추후 별도 작업에서 구현한다(2026-07-16 사용자 확인).

alter table public.sidebar_menu_items drop constraint if exists sidebar_menu_items_route_check;
alter table public.sidebar_menu_items add constraint sidebar_menu_items_route_check
  check (route is null or route in ('/standards', '/sites', '/documents', '/members', '/settings', '/work-orders'));

-- 설정 화면에서 사용자가 미리 만들어 둔 빈 "작업지시서" 그룹(하위 메뉴 없음)은 정리한다.
-- 이번에 추가하는 실제 리프 메뉴와 이름이 겹쳐 혼동을 주기 때문.
delete from public.sidebar_menu_items parent_group
where parent_group.label = '작업지시서'
  and parent_group.route is null
  and not exists (
    select 1 from public.sidebar_menu_items child where child.parent_id = parent_group.id
  );

-- "현장" 그룹이 있으면 그 하위에, 없으면 최상위(주 메뉴)에 "작업지시서" 리프를 추가한다.
do $$
declare
  site_group_id bigint;
  site_group_placement text;
  next_order int;
begin
  select id, placement into site_group_id, site_group_placement
  from public.sidebar_menu_items
  where route is null and label = '현장'
  limit 1;

  if site_group_id is not null then
    select coalesce(max(sort_order) + 1, 0) into next_order
    from public.sidebar_menu_items where parent_id = site_group_id;

    insert into public.sidebar_menu_items (label, route, parent_id, placement, sort_order)
    values ('작업지시서', '/work-orders', site_group_id, site_group_placement, next_order)
    on conflict (route) where route is not null do nothing;
  else
    insert into public.sidebar_menu_items (label, route, parent_id, placement, sort_order)
    values ('작업지시서', '/work-orders', null, 'primary', 100)
    on conflict (route) where route is not null do nothing;
  end if;
end $$;
