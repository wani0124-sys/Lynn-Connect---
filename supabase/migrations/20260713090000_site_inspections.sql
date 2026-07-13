-- 현장(공사현장) 목록과 현장이 받는 대외 점검(관공서/감리단/발주처/자체점검 등) 이력 관리용 테이블/스토리지.
-- task_standards(20260710090000)와 동일한 접근 방식: 앱은 apps/web의 React Router 서버(*.server.ts)에서
-- SUPABASE_SERVICE_ROLE_KEY로만 접근한다. anon/authenticated role에는 접근 정책을 부여하지 않는다(기본 차단).
-- 본사/현장 권한 판단은 애플리케이션 레이어(requireUser/requireHeadquarters)에서 수행한다.

create table if not exists public.sites (
  id bigint generated always as identity primary key,
  name text not null,
  address text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sites_name_key unique (name)
);

create table if not exists public.site_inspections (
  id uuid primary key default gen_random_uuid(),
  site_id bigint not null references public.sites (id) on delete cascade,
  title text not null,
  inspector_org text not null,
  inspected_at date not null,
  result text not null,
  next_inspection_at date,
  requires_reinspection boolean not null default false,
  note text,
  created_by text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_inspections_site_id_idx on public.site_inspections (site_id);
create index if not exists site_inspections_inspected_at_idx on public.site_inspections (inspected_at desc);

create table if not exists public.site_inspection_attachments (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.site_inspections (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists site_inspection_attachments_inspection_id_idx on public.site_inspection_attachments (inspection_id);

alter table public.sites enable row level security;
alter table public.site_inspections enable row level security;
alter table public.site_inspection_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sites' and policyname = 'sites_no_direct_access'
  ) then
    create policy "sites_no_direct_access" on public.sites
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_inspections' and policyname = 'site_inspections_no_direct_access'
  ) then
    create policy "site_inspections_no_direct_access" on public.site_inspections
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_inspection_attachments' and policyname = 'site_inspection_attachments_no_direct_access'
  ) then
    create policy "site_inspection_attachments_no_direct_access" on public.site_inspection_attachments
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('site-inspections', 'site-inspections', false)
on conflict (id) do nothing;
