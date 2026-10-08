-- 회원가입 승인 대기 상태 추가(2026-10-08 사용자 요청: "직접 본인이 등록해서 들어오는 방법. 대신 관리자의 승인이 있어야 해").
-- 로그인 화면의 회원가입(/signup)으로 신청한 계정은 status='pending'으로 저장되고 로그인할 수 없다.
-- 본사관리자(모든 신청) 또는 현장 마스터(자기 현장 현장관리자 신청)가 /members에서 승인하면 'active'가 된다.
-- 거절은 계정 행을 삭제한다.
-- Rollback:
--   delete from public.members where status = 'pending';
--   alter table public.members drop constraint if exists members_status_check;
--   alter table public.members add constraint members_status_check check (status in ('active', 'invited', 'suspended'));

alter table public.members drop constraint if exists members_status_check;
alter table public.members
  add constraint members_status_check check (status in ('active', 'invited', 'suspended', 'pending'));
