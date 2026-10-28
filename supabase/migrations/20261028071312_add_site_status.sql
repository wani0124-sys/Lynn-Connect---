-- 현장 진행 상태 추가(2026-10-28 사용자 요청: "계속 현장은 늘어날거고 준공나는 현장도 생기고 구분이 되야할 것 같아").
-- 대외기관 점검(/sites)에서 현장을 '진행 중'과 '준공'으로 나눠 보여준다. 준공일은 저장하지 않고 상태만 둔다.
-- 기존 현장은 모두 'active'(진행 중)로 시작한다.
-- Rollback:
--   alter table public.sites drop constraint if exists sites_status_check;
--   alter table public.sites drop column if exists status;

alter table public.sites add column if not exists status text not null default 'active';

alter table public.sites drop constraint if exists sites_status_check;
alter table public.sites
  add constraint sites_status_check check (status in ('active', 'completed'));
