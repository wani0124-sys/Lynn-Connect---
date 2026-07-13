-- 메일 아카이브 기능 제거. 부서별 업무기준(standard_posts 등)이 EML 파싱/저장을 대체하면서
-- 별도 메일 아카이브 기능은 더 이상 쓰지 않는다.
-- storage 버킷(mail-archive)과 그 안의 객체는 이 마이그레이션이 아니라 서비스 롤 키로 Storage API를
-- 통해 별도로 비우고 삭제한다(버킷 삭제는 raw SQL delete만으로는 객체 스토리지까지 정리되지 않는다).

drop policy if exists "emails_no_direct_access" on public.emails;
drop table if exists public.emails;
