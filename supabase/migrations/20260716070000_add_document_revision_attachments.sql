-- 문서 리비전(document_revisions)에 추가로 첨부하는 참고용 서브 파일. 메인 파일(PDF, diff 계산 대상)은
-- 기존대로 document_revisions.storage_path에 저장하고, 함께 올리는 부가 파일들은 이 테이블에 메타를 두고
-- 같은 document-revisions 버킷의 별도 경로(revisions/{revisionId}/attachments/...)에 저장한다.
-- site_inspection_attachments(20260713090000)와 동일한 접근 방식: SUPABASE_SERVICE_ROLE_KEY로만 접근.

create table if not exists public.document_revision_attachments (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.document_revisions (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists document_revision_attachments_revision_id_idx on public.document_revision_attachments (revision_id);

alter table public.document_revision_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_revision_attachments' and policyname = 'document_revision_attachments_no_direct_access'
  ) then
    create policy "document_revision_attachments_no_direct_access" on public.document_revision_attachments
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;
