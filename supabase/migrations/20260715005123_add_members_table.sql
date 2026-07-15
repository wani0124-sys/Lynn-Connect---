-- 멤버 관리(계정) 데이터를 인메모리 seedMembers(apps/web/app/entities/member/model/member.ts)에서
-- Supabase로 이관한다. 인메모리 저장소는 서버 프로세스 재시작 시 초기 시드로 리셋되어
-- 저장/삭제한 계정 변경이 유실되는 문제가 있었다(2026-07-15).
-- task_standards/sites와 동일한 접근 방식: 앱은 apps/web의 React Router 서버(*.server.ts)에서
-- SUPABASE_SERVICE_ROLE_KEY로만 접근한다. anon/authenticated role에는 접근 정책을 부여하지 않는다(기본 차단).

create sequence if not exists public.members_id_seq;

create table if not exists public.members (
  id text primary key default ('USR-' || lpad(nextval('public.members_id_seq')::text, 3, '0')),
  name text not null,
  email text not null,
  role text not null,
  status text not null default 'invited',
  -- 현장(member) 계정이 소속된 현장. 본사(admin/manager) 계정은 null. 현장 삭제 시 계정은 유지하고 배정만 해제한다.
  site_id bigint references public.sites (id) on delete set null,
  "position" text,
  department text,
  menu_permission text not null default 'limited',
  -- 관리 현장 권한. null이면 전체 현장, 배열이면 지정 현장만. 현재는 표시/필터 용도이며
  -- 실제 쓰기 권한 판정(requireSiteWriteAccess)은 site_id만 사용한다.
  managed_site_ids bigint[],
  -- 비밀번호 salt:hash(scrypt, node:crypto). 평문 비밀번호는 저장하지 않는다.
  password_hash text not null,
  joined_at date not null default current_date,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_role_check check (role in ('admin', 'manager', 'member')),
  constraint members_status_check check (status in ('active', 'invited', 'suspended')),
  constraint members_menu_permission_check check (menu_permission in ('all', 'limited'))
);

create unique index if not exists members_email_lower_idx on public.members (lower(email));
create index if not exists members_site_id_idx on public.members (site_id);

alter table public.members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'members' and policyname = 'members_no_direct_access'
  ) then
    create policy "members_no_direct_access" on public.members
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

-- site_id는 on delete set null로 처리되지만 managed_site_ids(bigint[])는 FK로 표현할 수 없다.
-- 현장이 삭제되면 해당 id를 모든 멤버의 managed_site_ids에서 제거해 고아 참조를 남기지 않는다.
create or replace function public.strip_deleted_site_from_managed_sites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.members
  set managed_site_ids = array_remove(managed_site_ids, old.id)
  where managed_site_ids is not null and old.id = any(managed_site_ids);
  return old;
end;
$$;

drop trigger if exists sites_cleanup_managed_site_ids on public.sites;
create trigger sites_cleanup_managed_site_ids
  before delete on public.sites
  for each row execute function public.strip_deleted_site_from_managed_sites();

-- 데모 시드 계정 이관(기존 apps/web/app/entities/member/model/member.ts의 seedMembers와 동일한 데이터).
-- 비밀번호는 apps/web/app/features/auth/model/credentials.server.ts의 기존 데모 비밀번호를 scrypt로 해시한 값이다.
insert into public.members
  (id, name, email, role, status, site_id, "position", department, menu_permission, managed_site_ids, password_hash, joined_at, must_change_password)
values
  ('USR-001', '관리자', 'admin@woomi.dev', 'admin', 'active', null, '대표', '경영지원팀', 'all', null,
    'b9b0d004f0e7df6ea21038d3c9f3a190:cbf7b9e5e2ebf4f454cebd46abc277a6c65debde7b203a3801a743465add6f6b85f0264fdbbac917f2df3e602c76dd8a4d0f88d9d614495e32b4c9eb2f6b9359',
    '2026-01-05', false),
  ('USR-002', '이도현', 'manager@woomi.dev', 'manager', 'active', null, '팀장', '건축기획팀', 'all', null,
    '73b17d8c1553f68bb6bdd1b6f6a1aa6c:d5cf40ba355a14f918147eb5652293096751f06b7d2156f051404aee4b8d7670eefef76216cece788d9852d13787a41c2ae55a1b14dd905608ddbfee71ca827e',
    '2026-02-10', false),
  ('USR-003', '박서준', 'member@woomi.dev', 'member', 'active', (select id from public.sites where id = 1), '과장', '현장관리팀', 'limited',
    (select array_agg(id) from public.sites where id = 1),
    '449b1799418a341963273e71972f8cd4:028cee11393f53fbec782b15066cb17d14a200bca5f00d22b491e8294af78b062ada60eb493859512ee33f79f39dd951d339946fc548921844870c220e254750',
    '2026-03-02', false),
  ('USR-004', '최유나', 'yuna@woomi.dev', 'member', 'invited', null, '대리', '현장관리팀', 'limited', array[]::bigint[],
    '1f0ac26dba1f2d40883b31eafa50e344:50886f34862a4c5d3041661078d1d6cff85716349c93e5e9df40996b11a41e094ccf53e403023232a031b7cfa860d7eab1e0b2a26a000b220820590e92164d4b',
    '2026-04-18', true),
  ('USR-005', '정민재', 'minjae@woomi.dev', 'manager', 'suspended', null, '부장', '건축기획팀', 'all', null,
    '1f0ac26dba1f2d40883b31eafa50e344:50886f34862a4c5d3041661078d1d6cff85716349c93e5e9df40996b11a41e094ccf53e403023232a031b7cfa860d7eab1e0b2a26a000b220820590e92164d4b',
    '2026-01-20', false),
  ('USR-006', '한지우', 'jiwoo@woomi.dev', 'member', 'invited', null, '사원', '현장관리팀', 'limited', array[]::bigint[],
    '1f0ac26dba1f2d40883b31eafa50e344:50886f34862a4c5d3041661078d1d6cff85716349c93e5e9df40996b11a41e094ccf53e403023232a031b7cfa860d7eab1e0b2a26a000b220820590e92164d4b',
    '2026-05-30', true)
on conflict (id) do nothing;

select setval('public.members_id_seq', 6, true);
