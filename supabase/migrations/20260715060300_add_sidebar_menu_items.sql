-- 사이드바 메뉴(상위/하위 구조, 순서, 제목)를 관리자가 설정 화면에서 편집할 수 있도록
-- apps/web/app/shared/config/nav.ts의 하드코딩된 배열을 DB 테이블로 이관한다.
-- 메뉴가 가리키는 실제 화면(route)은 기존 5개(부서별 업무기준/현장 점검/문서 관리/멤버 관리/설정)로 고정하고,
-- 제목/순서/상위-하위 묶음(2단계 고정)만 관리자가 바꿀 수 있게 한다.
-- task_standards/sites와 동일한 접근 방식: 앱은 apps/web의 React Router 서버(*.server.ts)에서
-- SUPABASE_SERVICE_ROLE_KEY로만 접근한다. anon/authenticated role에는 접근 정책을 부여하지 않는다(기본 차단).

create table if not exists public.sidebar_menu_items (
  id bigint generated always as identity primary key,
  label text not null,
  -- null이면 하위 메뉴를 묶는 상위 카테고리(그룹). 값이 있으면 해당 화면으로 이동하는 리프 메뉴.
  route text,
  -- 2단계 고정: parent_id가 있는 행(하위 메뉴)은 반드시 route가 있어야 한다(하위가 또 그룹일 수 없음).
  -- 그룹(상위 메뉴)이 삭제되면 하위 메뉴는 삭제되지 않고 다시 최상위로 승격된다(on delete set null).
  parent_id bigint references public.sidebar_menu_items (id) on delete set null,
  -- 사이드바 상단(주메뉴, 스크롤 영역) vs 하단(관리 메뉴, 고정 영역) 배치.
  placement text not null default 'primary',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sidebar_menu_items_route_check check (route is null or route in ('/standards', '/sites', '/documents', '/members', '/settings')),
  constraint sidebar_menu_items_placement_check check (placement in ('primary', 'secondary')),
  constraint sidebar_menu_items_leaf_needs_route check (parent_id is null or route is not null)
);

create unique index if not exists sidebar_menu_items_route_key on public.sidebar_menu_items (route) where route is not null;
create index if not exists sidebar_menu_items_parent_id_idx on public.sidebar_menu_items (parent_id);

alter table public.sidebar_menu_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sidebar_menu_items' and policyname = 'sidebar_menu_items_no_direct_access'
  ) then
    create policy "sidebar_menu_items_no_direct_access" on public.sidebar_menu_items
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

-- 2단계 고정 강제: 하위 메뉴의 parent_id가 가리키는 행은 반드시 최상위(parent_id is null)여야 하고,
-- 같은 placement에 속해야 한다(상위-하위가 서로 다른 사이드바 영역에 표시되는 것을 방지).
create or replace function public.enforce_sidebar_menu_items_two_levels()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_row public.sidebar_menu_items%rowtype;
begin
  if new.parent_id is not null then
    select * into parent_row from public.sidebar_menu_items where id = new.parent_id;
    if parent_row.id is null then
      raise exception 'parent_id %가 존재하지 않습니다', new.parent_id;
    end if;
    if parent_row.parent_id is not null then
      raise exception '사이드바 메뉴는 2단계까지만 허용됩니다(상위 메뉴 아래에 상위 메뉴를 지정할 수 없음)';
    end if;
    if parent_row.route is not null then
      raise exception '상위 메뉴로 지정하려는 항목이 이미 화면(route)을 가진 리프 메뉴입니다. 그룹만 상위 메뉴가 될 수 있습니다';
    end if;
    if parent_row.placement <> new.placement then
      raise exception '하위 메뉴는 상위 메뉴와 같은 placement(%)를 가져야 합니다', parent_row.placement;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sidebar_menu_items_two_levels on public.sidebar_menu_items;
create trigger sidebar_menu_items_two_levels
  before insert or update on public.sidebar_menu_items
  for each row execute function public.enforce_sidebar_menu_items_two_levels();

-- 기존 apps/web/app/shared/config/nav.ts의 navItems/secondaryNavItems와 동일한 초기 상태로 시드한다.
insert into public.sidebar_menu_items (label, route, parent_id, placement, sort_order) values
  ('부서별 업무기준 (메일공지)', '/standards', null, 'primary', 0),
  ('현장 점검', '/sites', null, 'primary', 1),
  ('문서 관리', '/documents', null, 'primary', 2),
  ('멤버 관리', '/members', null, 'secondary', 0),
  ('설정', '/settings', null, 'secondary', 1)
on conflict (route) where route is not null do nothing;
