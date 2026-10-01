-- 현장별 중요메일 관리("부서별 업무기준"과 동일한 EML 업로드·정리 기능을 현장 단위로 제공).
-- standard_posts(20260710090000)와 달리 분류 축이 부서가 아니라 현장(sites)이며, 구분자(카테고리)는
-- standard_categories를 그대로 재사용한다(같은 개념을 부서 화면과 현장 화면이 공유). 접근 방식은
-- 기존 테이블과 동일하게 앱이 SUPABASE_SERVICE_ROLE_KEY로만 접근하고 anon/authenticated는 기본 차단한다.
--
-- 쓰기 권한은 site_inspections와 동일하게 애플리케이션 레이어(requireSiteWriteAccess)에서 판정한다:
-- 본사(admin/manager)는 모든 현장에, 현장(member) 계정은 자신이 소속된 현장에만 쓸 수 있다.
-- 구분자(카테고리) 자체의 생성/수정/삭제는 부서 화면과 동일하게 본사 전용(requireHeadquarters)이다.

create table if not exists public.site_mail_posts (
  id uuid primary key default gen_random_uuid(),
  site_id bigint not null references public.sites (id) on delete cascade,
  category_id bigint references public.standard_categories (id) on delete set null,
  title text not null,
  sender_email text,
  sender_name text,
  sent_at timestamptz,
  body_html text,
  body_text text,
  content_hash text,
  created_by text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 같은 메일이 여러 현장에 전달될 수 있어 content_hash는 전역이 아니라 현장 단위로만 중복을 막는다.
  constraint site_mail_posts_site_content_hash_key unique (site_id, content_hash)
);

create index if not exists site_mail_posts_site_id_idx on public.site_mail_posts (site_id);
create index if not exists site_mail_posts_category_id_idx on public.site_mail_posts (category_id);
create index if not exists site_mail_posts_sent_at_idx on public.site_mail_posts (sent_at desc);

create table if not exists public.site_mail_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.site_mail_posts (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists site_mail_attachments_post_id_idx on public.site_mail_attachments (post_id);

alter table public.site_mail_posts enable row level security;
alter table public.site_mail_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_mail_posts' and policyname = 'site_mail_posts_no_direct_access'
  ) then
    create policy "site_mail_posts_no_direct_access" on public.site_mail_posts
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_mail_attachments' and policyname = 'site_mail_attachments_no_direct_access'
  ) then
    create policy "site_mail_attachments_no_direct_access" on public.site_mail_attachments
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('site-mails', 'site-mails', false)
on conflict (id) do nothing;

-- 사이드바 메뉴가 가리킬 수 있는 고정 화면을 5개 -> 6개로 확장한다: "/site-mails"(현장 메일함) 추가.
alter table public.sidebar_menu_items drop constraint if exists sidebar_menu_items_route_check;
alter table public.sidebar_menu_items add constraint sidebar_menu_items_route_check
  check (
    route is null
    or route in ('/standards', '/sites', '/documents', '/members', '/settings', '/site-mails')
    or route ~ '^/menu/[0-9a-f]{8}$'
  );

-- "현장" 그룹이 있으면 그 하위에, 없으면 최상위(주 메뉴)에 "현장 메일함" 리프를 추가한다
-- (20260716090000_add_work_orders_menu_route.sql과 동일한 방식).
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
    values ('현장 메일함', '/site-mails', site_group_id, site_group_placement, next_order)
    on conflict (route) where route is not null do nothing;
  else
    insert into public.sidebar_menu_items (label, route, parent_id, placement, sort_order)
    values ('현장 메일함', '/site-mails', null, 'primary', 100)
    on conflict (route) where route is not null do nothing;
  end if;
end $$;
