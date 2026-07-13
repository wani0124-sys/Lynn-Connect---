-- 메일 아카이브(.eml 저장) 기능용 테이블/스토리지
-- 앱은 apps/web의 React Router 서버(*.server.ts)에서 SUPABASE_SERVICE_ROLE_KEY로만 접근한다.
-- 브라우저는 Supabase를 직접 호출하지 않으므로 anon/authenticated role에는 접근 정책을 부여하지 않는다(기본 차단).

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  sender_email text not null,
  sender_name text not null default '',
  subject text not null,
  body text not null default '',
  content_hash text not null,
  storage_path text not null,
  is_archived boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint emails_content_hash_key unique (content_hash)
);

create index if not exists emails_created_at_idx on public.emails (created_at desc);
create index if not exists emails_is_archived_idx on public.emails (is_archived);

alter table public.emails enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'emails' and policyname = 'emails_no_direct_access'
  ) then
    create policy "emails_no_direct_access" on public.emails
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('mail-archive', 'mail-archive', false)
on conflict (id) do nothing;
