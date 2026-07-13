-- 부서별 업무기준(사내 기준/공지 메일 아카이브) 게시판용 테이블/스토리지
-- mail_archive(20260709120000)와 동일한 접근 방식: 앱은 apps/web의 React Router 서버(*.server.ts)에서
-- SUPABASE_SERVICE_ROLE_KEY로만 접근한다. 브라우저는 Supabase를 직접 호출하지 않으므로
-- anon/authenticated role에는 접근 정책을 부여하지 않는다(기본 차단). 본사/현장 권한 판단은
-- 애플리케이션 레이어(requireUser/requireHeadquarters)에서 수행한다.

create table if not exists public.standard_departments (
  id bigint generated always as identity primary key,
  name text not null,
  parent_id bigint references public.standard_departments (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint standard_departments_name_key unique (name)
);

create index if not exists standard_departments_parent_id_idx on public.standard_departments (parent_id);

create table if not exists public.standard_categories (
  id bigint generated always as identity primary key,
  name text not null,
  color text not null default '#6b7280',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint standard_categories_name_key unique (name)
);

create table if not exists public.standard_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id bigint references public.standard_departments (id) on delete set null,
  category_id bigint references public.standard_categories (id) on delete set null,
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
  constraint standard_posts_content_hash_key unique (content_hash)
);

create index if not exists standard_posts_department_id_idx on public.standard_posts (department_id);
create index if not exists standard_posts_category_id_idx on public.standard_posts (category_id);
create index if not exists standard_posts_sent_at_idx on public.standard_posts (sent_at desc);

create table if not exists public.standard_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.standard_posts (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists standard_attachments_post_id_idx on public.standard_attachments (post_id);

alter table public.standard_departments enable row level security;
alter table public.standard_categories enable row level security;
alter table public.standard_posts enable row level security;
alter table public.standard_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'standard_departments' and policyname = 'standard_departments_no_direct_access'
  ) then
    create policy "standard_departments_no_direct_access" on public.standard_departments
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'standard_categories' and policyname = 'standard_categories_no_direct_access'
  ) then
    create policy "standard_categories_no_direct_access" on public.standard_categories
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'standard_posts' and policyname = 'standard_posts_no_direct_access'
  ) then
    create policy "standard_posts_no_direct_access" on public.standard_posts
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'standard_attachments' and policyname = 'standard_attachments_no_direct_access'
  ) then
    create policy "standard_attachments_no_direct_access" on public.standard_attachments
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('task-standards', 'task-standards', false)
on conflict (id) do nothing;
