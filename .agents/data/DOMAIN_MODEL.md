# DOMAIN_MODEL.md

이 문서는 프로젝트의 핵심 업무 개념과 도메인 관계를 진행 중에 정리하는 문서다.

프로젝트 시작 시 억지로 완성하지 않는다. 실제 기능, 화면, DB, API가 생기면서 확인된 내용만 추가한다.

---

## 작성 시점

- 핵심 도메인 이름이 정해졌을 때
- 업무 엔티티 간 관계가 코드나 DB에 반영될 때
- 상태값, 권한, 생명주기 규칙이 생길 때
- 도메인 용어가 팀 내에서 반복해서 쓰이기 시작할 때

---

## 작성할 내용

```txt
Domain:
Purpose:
Main users:
Core entities:
Entity relationships:
Status lifecycle:
Role/permission rules:
Important invariants:
Related screens:
Related APIs:
Related tables:
Open questions:
```

---

## Domain Notes

아직 작성된 도메인 모델이 없다. 실제 구현이 생기면 이 섹션에 도메인별로 추가한다.

```txt
Domain: Task Standards (부서별 업무기준)
Purpose: 본사에서 배포한 기준·공지 메일(.eml)을 부서/구분자별로 정리해 현장과 공유하는 게시판. 코딩연습(레거시 Express+SQLite 앱)의 /standards 기능을 Supabase 기반으로 포팅했다.
Main users: 본사(건축기획팀 등) 작성/관리, 현장 주요 직책자 열람
Core entities: StandardDepartment(부서, 2단계 계층), StandardCategory(구분자: 업무기준/시공기준/기타, 색상), StandardPost(게시글: EML 파싱 결과), StandardAttachment(게시글별 첨부파일)
Entity relationships: StandardPost N:1 StandardDepartment(nullable), StandardPost N:1 StandardCategory(nullable), StandardPost 1:N StandardAttachment(cascade delete). StandardDepartment는 parent_id로 자기 자신을 참조하는 2단계 트리(상위 부서 삭제 시 하위 부서는 루트로 승격, 부서/구분자 삭제 시 게시글은 NULL로 정리되고 게시글 자체는 유지됨).
Status lifecycle: 없음(게시글은 등록 후 삭제 전까지 단일 상태). 첨부파일은 개별 추가/삭제 가능.
Role/permission rules: 애플리케이션 레이어에서 판단 — requireUser(열람), requireHeadquarters(업로드/부서·구분자 관리/게시글·첨부 수정삭제). DB RLS는 전체 차단이며 서버가 service role key로만 접근한다.
Important invariants: content_hash(제목+발신자+발송일+본문 sha256)로 동일 메일 중복 업로드를 막는다. 첨부파일은 storage 업로드 후 DB insert(실패 시 업로드분 정리)하는 순서를 지킨다.
Related screens: /standards(게시판+부서/구분자 관리 모달), /standards/new(다중 EML 업로드), /standards/:postId(상세, 첨부 관리)
Related APIs: apps/web/app/routes/standards.tsx, standards-new.tsx, standards-detail.tsx (loader/action이 features/task-standards/model/task-standards.repository.server.ts를 직접 호출, 별도 REST API 없음)
Related tables: standard_departments, standard_categories, standard_posts, standard_attachments (DB_SCHEMA.md 참고)
Open questions: 없음. 레거시 standards.db 실이관은 scripts/migrate-task-standards.mjs로 2026-07-10 완료(부서 29, 구분자 3, 게시글 167, 첨부 482 전량 이관, 실패 0건). 같은 날 메일 아카이브(emails 테이블/mail-archive 버킷) 기능은 부서별 업무기준과 기능이 겹쳐 완전히 제거했다.
```
