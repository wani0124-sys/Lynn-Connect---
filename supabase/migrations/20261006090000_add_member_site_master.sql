-- 현장 마스터 지정(2026-10-06 사용자 요청: "현장의 마스터를 정해 인원 계정을 만들 수 있게. 본사 관리자가 현장인원을 다 하려니 너무 힘드네").
-- role은 그대로 'member'(현장관리자)이고, 이 플래그가 true인 현장 계정은 자기 현장 소속 일반 현장 계정을
-- 생성·수정·삭제할 수 있다. 권한 범위 판정은 앱(apps/web/app/routes/members.tsx)에서 한다.
-- 본사(admin/manager) 계정에는 의미가 없으므로 앱에서 항상 false로 저장한다.
-- Rollback: alter table public.members drop column if exists is_site_master;

alter table public.members
  add column if not exists is_site_master boolean not null default false;
