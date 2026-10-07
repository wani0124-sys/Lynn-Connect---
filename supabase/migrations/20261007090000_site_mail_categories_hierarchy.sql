-- 현장 메일함 구분자를 최대 3단계로 나눠 관리한다(2026-10-07 사용자 요청: "공사(1단계) → 건축(2단계) → 설계(3단계)").
-- site_mail_categories에 상위 구분자(parent_id)를 붙인다. parent_id가 null이면 1단계 구분자다.
-- 메일은 어느 단계의 구분자에든 붙일 수 있고, 상위 구분자로 거르면 하위 구분자 메일까지 함께 보인다(앱에서 처리).
-- 3단계 제한·상위 구분자가 같은 현장 소속인지는 앱(site-mail-categories.repository.server.ts)에서 검사한다.
--
-- 기존 구분자는 모두 1단계(parent_id null)로 그대로 남는다. 이름에 괄호로 단계를 흉내 낸 "공사(건축)" 등은
-- 자동으로 쪼개지 않는다 — 구분자 관리 팝업에서 사용자가 직접 정리한다.

alter table public.site_mail_categories
  add column if not exists parent_id bigint references public.site_mail_categories (id) on delete cascade;

create index if not exists site_mail_categories_parent_id_idx on public.site_mail_categories (parent_id);

-- 이름 중복 기준을 "현장 전체"에서 "같은 상위 구분자 안"으로 바꾼다(공사 → 건축, 공무 → 건축 둘 다 허용).
alter table public.site_mail_categories drop constraint if exists site_mail_categories_site_name_key;
create unique index if not exists site_mail_categories_root_name_key
  on public.site_mail_categories (site_id, name) where parent_id is null;
create unique index if not exists site_mail_categories_child_name_key
  on public.site_mail_categories (parent_id, name) where parent_id is not null;
