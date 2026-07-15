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
-- 비밀번호는 계정별로 무작위 생성한 값을 scrypt로 해시했다(저장소가 public이라 사전 단어 기반
-- 데모 비밀번호를 그대로 커밋하지 않는다). 실제 값은 계정 관리자에게 별도로 전달한다.
insert into public.members
  (id, name, email, role, status, site_id, "position", department, menu_permission, managed_site_ids, password_hash, joined_at, must_change_password)
values
  ('USR-001', '관리자', 'admin@woomi.dev', 'admin', 'active', null, '대표', '경영지원팀', 'all', null,
    'd8138deb48965db2140537052b7560a2:34ccd81cec6a611e25cdaae789bf25d7b8cc20c832bde9ff382430f41c896bff3bf6f9d2ab060b50e80ce301b419e96c092ad77621c9698c40795f96af5a4f1d',
    '2026-01-05', false),
  ('USR-002', '이도현', 'manager@woomi.dev', 'manager', 'active', null, '팀장', '건축기획팀', 'all', null,
    '80e512c4e1ad765c59b5638011410c94:e8f7a4fa8add66cc633e514826379ce0312b38a951d84ce9fed2f3af073ff8defe58c19082367cba824b2b11366bc690ae76c7e5444b998bfd32735ac0791d5a',
    '2026-02-10', false),
  ('USR-003', '박서준', 'member@woomi.dev', 'member', 'active', (select id from public.sites where id = 1), '과장', '현장관리팀', 'limited',
    (select array_agg(id) from public.sites where id = 1),
    'cf46600e0cdb74bac8ded7cc39df6623:4e1ad03c622c89ccb16cfd4a5d3f78c6898c1d79482f312e22aa412fdb0a33770a2ae62716e265e79b67798ca3b03a7e7b4f24daf8a280c5a881bad71598d212',
    '2026-03-02', false),
  ('USR-004', '최유나', 'yuna@woomi.dev', 'member', 'invited', null, '대리', '현장관리팀', 'limited', array[]::bigint[],
    '316157e48fe03e5e4e9119cf4cc94d73:f81f26850a8f59046804492bb3fef5b289dadeb3be28f5d2a47edf861dd059e976fffe87f2fed7b64c7203ee0ee4f1b3e6c745f0f6f8e6baf2adfe0718547234',
    '2026-04-18', true),
  ('USR-005', '정민재', 'minjae@woomi.dev', 'manager', 'suspended', null, '부장', '건축기획팀', 'all', null,
    '9a2a8aa1556ec21f846d7674963a7634:bd741e0c22b752d4e6476f258f72fb141cadffbf870fa1f9b4ef64633ea1a4475b609a7c37d84e39c1f9c6583a76c72a40ad8fb7cfd583a62a10040cfadbdb1d',
    '2026-01-20', false),
  ('USR-006', '한지우', 'jiwoo@woomi.dev', 'member', 'invited', null, '사원', '현장관리팀', 'limited', array[]::bigint[],
    'ec5029c4c1a5a9437bf73e8abe5dd08f:414bded5c522de5eec82e34c15e02aa84b157469a5dafb5fac0d7183acf7a6420b8c670674a1e9c73581aced925a74f1b765494fd39c5cc44e94580cc505c952',
    '2026-05-30', true)
on conflict (id) do nothing;

select setval('public.members_id_seq', 6, true);
