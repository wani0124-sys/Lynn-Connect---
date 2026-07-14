-- 반복 개정되는 현장 안내 문서(예: "현장 주요 업무 체크리스트") 시리즈와 리비전(Rev.0, Rev.1, ...) 관리.
-- task_standards/site_inspections와 동일한 접근 방식: 앱은 apps/web의 React Router 서버(*.server.ts)에서
-- SUPABASE_SERVICE_ROLE_KEY로만 접근한다. anon/authenticated role에는 접근 정책을 부여하지 않는다(기본 차단).
-- 본사/현장 권한 판단은 애플리케이션 레이어(requireUser/requireHeadquarters)에서 수행한다.

create table if not exists public.document_series (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_series_name_key unique (name)
);

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  series_id bigint not null references public.document_series (id) on delete cascade,
  revision_label text not null,
  effective_date date,
  filename text not null,
  storage_path text not null,
  mime_type text,
  extracted_text text,
  diff_json jsonb,
  uploaded_by text not null,
  created_at timestamptz not null default now(),
  constraint document_revisions_series_label_key unique (series_id, revision_label)
);

create index if not exists document_revisions_series_id_idx on public.document_revisions (series_id);
create index if not exists document_revisions_created_at_idx on public.document_revisions (created_at desc);

alter table public.document_series enable row level security;
alter table public.document_revisions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_series' and policyname = 'document_series_no_direct_access'
  ) then
    create policy "document_series_no_direct_access" on public.document_series
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_revisions' and policyname = 'document_revisions_no_direct_access'
  ) then
    create policy "document_revisions_no_direct_access" on public.document_revisions
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('document-revisions', 'document-revisions', false)
on conflict (id) do nothing;
