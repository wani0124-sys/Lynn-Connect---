-- 대외 점검 결과보고 양식(점검취지/점검자/점검내용/점검결과 상세/지적사항/점검기간·시간)을
-- site_inspections에 기록할 수 있도록 컬럼을 추가한다. 전부 nullable additive column이라
-- 기존 row에는 영향이 없다.

alter table public.site_inspections
  add column if not exists inspected_at_end date,
  add column if not exists inspection_time text,
  add column if not exists purpose text,
  add column if not exists inspectors text,
  add column if not exists content text,
  add column if not exists result_detail text,
  add column if not exists findings text;
