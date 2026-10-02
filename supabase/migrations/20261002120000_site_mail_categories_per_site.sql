-- 현장 메일함 구분자를 현장별로 따로 관리한다(2026-10-02 사용자 요청: "각 현장별로도 구분자는 각각 관리가 되어야 해").
-- 20261002090000에서 만든 site_mail_categories는 메일함 전체가 공유하는 한 벌이었다. 여기에 site_id를 붙여
-- 현장마다 독립적인 구분자 목록을 갖게 한다. 같은 이름도 현장이 다르면 따로 만들 수 있다(unique: site_id + name).
--
-- 시작 상태: 지금 공유 목록(site_id 없음)을 현재 메일함 현장마다 한 벌씩 복사하고, 기존 메일의 category_id를
-- 같은 현장·같은 이름의 복사본으로 옮긴 뒤 공유 행을 지운다. 이후 새로 만드는 현장은 빈 구분자 목록으로 시작한다.
-- 메일의 구분자가 같은 현장 소속인지는 앱(site-mail-categories.repository.server.ts#assertSiteMailCategory)에서 검사한다.

alter table public.site_mail_categories
  add column if not exists site_id bigint references public.site_mail_sites (id) on delete cascade;

-- 이름 unique를 전역 -> 현장 단위로 바꾼다(복사본이 같은 이름을 가지므로 insert보다 먼저).
alter table public.site_mail_categories drop constraint if exists site_mail_categories_name_key;
alter table public.site_mail_categories
  add constraint site_mail_categories_site_name_key unique (site_id, name);

insert into public.site_mail_categories (site_id, name, color, sort_order)
select s.id, c.name, c.color, c.sort_order
from public.site_mail_sites s
cross join public.site_mail_categories c
where c.site_id is null;

update public.site_mail_posts p
set category_id = copy.id
from public.site_mail_categories shared
join public.site_mail_categories copy on copy.name = shared.name and copy.site_id is not null
where shared.site_id is null
  and p.category_id = shared.id
  and copy.site_id = p.site_id;

delete from public.site_mail_categories where site_id is null;

alter table public.site_mail_categories alter column site_id set not null;

create index if not exists site_mail_categories_site_id_idx on public.site_mail_categories (site_id);
