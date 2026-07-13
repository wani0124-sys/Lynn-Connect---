# DB_SCHEMA.md

이 문서는 프로젝트의 DB table, column, index, RLS, RPC/function 정보를 진행 중에 정리하는 문서다.

DB가 실제로 생기기 전까지는 비워둘 수 있다. 테이블, 컬럼, RPC, RLS가 추가되거나 변경될 때 같은 작업에서 갱신한다.

---

## 1. 작성 시점

- 새 테이블이 추가될 때
- 컬럼, 인덱스, foreign key, unique constraint가 바뀔 때
- RLS policy가 추가/수정/삭제될 때
- PostgreSQL function/RPC가 추가/수정/삭제될 때
- API 응답이나 프론트엔드 타입에 영향을 주는 DB 변경이 있을 때

---

## 2. 작성할 내용

```txt
Schema:
Table:
Purpose:
Columns:
Primary key:
Foreign keys:
Indexes:
Unique constraints:
RLS policies:
RPC/functions:
Related APIs:
Related frontend screens:
Migration file:
Notes:
```

---

## 3. Schema Design Guardrails

Supabase PostgreSQL을 기본 DB로 사용한다. DB schema는 앱 코드의 보조물이 아니라 제품 데이터의 장기 계약이다.

AI 에이전트는 아래 기준을 위반하는 schema를 만들기 전에 이유를 설명하고 사용자 승인을 받아야 한다.

### 3.1 기본 원칙

- 테이블은 실제 업무 명사와 생명주기를 기준으로 만든다.
- 테이블명, 컬럼명, constraint명, index명은 소문자 `snake_case`를 사용한다.
- 모든 주요 테이블은 primary key를 가진다.
- foreign key로 표현 가능한 관계는 문자열 이름이나 중복 id 배열로 대체하지 않는다.
- foreign key 컬럼은 조회/조인/삭제 경로를 기준으로 index 필요 여부를 반드시 검토한다.
- 시간 컬럼은 timezone-aware한 `timestamptz`를 우선한다.
- 금액이나 정확한 계산이 필요한 값은 `float` 대신 `numeric`을 사용한다.
- 단순 문자열은 `varchar(n)`보다 `text`를 우선하고, 길이 제한이 실제 업무 규칙일 때만 제한한다.
- 상태값은 `text + check constraint` 또는 명시적 enum을 사용한다.
- `created_at`, `updated_at`, `created_by`, `updated_by`가 필요한 업무 데이터인지 검토한다.

### 3.2 Constraint 기준

DB는 앱 코드가 놓친 잘못된 데이터를 마지막으로 막아야 한다.

우선 검토할 constraint:

- `not null`: 반드시 필요한 값
- `unique`: 중복되면 안 되는 업무 키
- `check`: status, role, amount, range 등 값 범위
- `foreign key`: 부모/자식 관계
- `on delete`: 삭제 정책

주의:

- `on delete cascade`는 데이터 손실 범위가 명확할 때만 사용한다.
- 업무적으로 보존해야 하는 기록은 cascade 삭제보다 soft delete 또는 상태 변경을 우선 검토한다.
- PostgreSQL은 `add constraint if not exists`를 지원하지 않는다. migration에서 constraint 중복 방지가 필요하면 `pg_constraint`를 확인하는 `do $$` block을 사용한다.

### 3.3 정규화 / 역정규화 기준

기본값은 과하지 않은 정규화다. 중복 저장은 이유가 있을 때만 허용한다.

정규화를 우선할 때:

- 같은 값이 여러 테이블에서 반복 수정될 수 있음
- 권한, 상태, 가격, 현장, 사용자처럼 기준 데이터가 따로 존재함
- 관계 무결성이 중요함
- 리포트나 화면 편의를 위해 원본 데이터를 훼손하면 안 됨

역정규화를 허용할 때:

- 조회 성능 병목이 확인되었음
- 외부 API 응답 또는 당시 상태를 스냅샷으로 보존해야 함
- 감사/이력/정산처럼 과거 값이 바뀌면 안 됨
- 집계 테이블, materialized view, search document처럼 목적이 명확함

역정규화 시 필수로 적을 것:

```txt
Duplicated data:
Source of truth:
Sync strategy:
Stale data tolerance:
Why normalization is not enough:
```

금지:

- 이유 없이 같은 업무 데이터를 여러 테이블에 중복 저장
- 조회가 편하다는 이유만으로 거대한 jsonb payload에 모든 데이터를 몰아넣기
- 관계형으로 표현해야 할 데이터를 comma-separated string으로 저장
- 상태값을 제약 없이 자유 문자열로 저장
- 프론트엔드 화면 구조 그대로 DB table을 설계

### 3.4 JSONB 사용 기준

`jsonb`는 유연하지만 schema 책임을 없애지 않는다.

허용:

- 외부 API 원본 payload 보관
- 사용자 설정, 레이아웃 설정, 필터 조건처럼 구조가 자주 바뀌는 값
- 검색/분석보다 저장과 재현이 중요한 스냅샷

주의:

- 자주 검색, 조인, 정렬, 권한 판정에 쓰는 값은 컬럼으로 승격한다.
- `jsonb` 내부 필드로 자주 조회하면 expression index 또는 GIN index를 검토한다.
- `jsonb`에도 최소한의 Zod schema 또는 DB check 전략을 둔다.

### 3.5 RLS / Security 기준

Supabase에서 exposed schema, 특히 `public` table은 RLS를 기본으로 검토한다.

- 사용자/조직/현장/tenant별 데이터는 RLS를 활성화한다.
- RLS policy는 실제 권한 모델을 기준으로 작성한다.
- `auth.uid()`만 복사해서 모든 테이블에 붙이지 않는다.
- `UPDATE`에는 SELECT policy도 필요하다는 점을 확인한다.
- 권한 판단에 `user_metadata`를 사용하지 않는다. 권한 데이터는 app metadata 또는 별도 권한 테이블을 사용한다.
- view는 RLS 우회 가능성을 검토한다. 필요한 경우 `security_invoker = true` 또는 private schema를 사용한다.
- `security definer` function은 exposed schema에 두지 않는다.

### 3.6 Index 기준

index는 AI가 자동으로 생성하는 대상이 아니라, 근거를 적고 제안하는 대상이다.

AI 에이전트는 index 생성 여부를 단정하지 않는다. query pattern, table size 예상, write frequency, existing indexes, FK delete behavior를 확인한 뒤 생성 또는 보류를 제안한다.

근거가 부족하면 index를 만들지 않고 `monitoring candidate`로 남긴다.

우선 index 검토 후보:

- join, cascade delete, 부모 기준 목록 조회에 쓰이는 foreign key 컬럼
- 자주 필터링하는 `tenant_id`, `site_id`, `user_id`, `status`
- 정렬/페이지네이션 기준 컬럼
- unique 업무 키
- 자주 검색하는 `jsonb`/text 필드

주의:

- foreign key라고 해서 전부 index를 만들지는 않는다.
- 작은 reference table, 거의 조회되지 않는 관계, 쓰기 빈도가 매우 높은 테이블은 index 비용을 함께 검토한다.
- 쓰기가 많은 테이블에 불필요한 index를 많이 만들지 않는다.
- 복합 index는 실제 where/order by 순서를 보고 설계한다.
- soft delete를 쓰면 partial index를 검토한다.

index 제안 시 필수로 적을 것:

```txt
Proposed index:
Expected query:
Where/order by/join condition:
Estimated table size:
Read/write pattern:
Existing overlapping indexes:
FK on delete behavior:
Alternative considered:
Decision: create / defer / reject
Reason:
Monitoring candidate:
```

사용자 승인이 필요한 index:

- production 대형 테이블에 추가하는 index
- unique index
- 복합 index
- partial index
- expression index
- `jsonb` GIN index
- RLS 성능 개선을 위한 index
- lock 또는 쓰기 성능에 영향이 클 수 있는 index

---

## 4. Review Checklist

새 table 또는 큰 schema 변경 시 아래를 확인한다.

```txt
Is the table a real domain concept?
Primary key exists:
Foreign keys defined:
FK index decision:
Required not-null constraints:
Unique constraints:
Check constraints:
RLS enabled or explicitly not needed:
Indexes match query patterns:
Normalization/denormalization reason:
JSONB reason:
Migration file:
Rollback impact:
```

---

## 5. Schema Notes

```txt
Schema: public
Table: emails (제거됨, 2026-07-10)
Purpose: (과거) 본사 기준/공지 메일(.eml) 아카이브. 부서별 업무기준(standard_posts 등)이 부서/구분자 분류와 첨부파일 개별 추출까지 포함해 상위 호환하므로 별도 메일 아카이브 기능을 제거했다.
Removed by: supabase/migrations/20260710120000_drop_mail_archive.sql (테이블/정책 drop). storage 버킷 mail-archive와 그 안의 객체는 Storage API로 별도 삭제.
Notes: 관련 라우트(apps/web/app/routes/mails.tsx, mail-new.tsx, mail-detail.tsx)와 apps/web/app/features/mail-archive/, apps/web/app/entities/mail/ 코드도 같은 작업에서 삭제했다. 데이터는 복구 불가.
```

```txt
Schema: public
Table: standard_departments
Purpose: 부서별 업무기준 게시판의 부서 트리(2단계, parent_id로 표현). 코딩연습/standards_bot.js의 departments 테이블을 이관한 구조.
Columns:
  id bigint (identity)
  name text
  parent_id bigint (self-FK, on delete set null)
  sort_order int
  created_at timestamptz
Primary key: id
Foreign keys: parent_id -> standard_departments(id) on delete set null
Indexes: standard_departments_parent_id_idx
Unique constraints: standard_departments_name_key (name)
RLS policies: RLS enabled. standard_departments_no_direct_access(전체 거부, anon/authenticated) — mail_archive의 emails와 동일하게 서버가 service role로만 접근.
RPC/functions: 없음
Related APIs: apps/web/app/routes/standards.tsx (loader/action, intent=department.*)
Related frontend screens: /standards (부서 탭바 + 부서 관리 모달)
Migration file: supabase/migrations/20260710090000_task_standards.sql
Notes: 부서 삭제 시 해당 부서 게시글은 standard_posts.department_id=NULL로 정리한 뒤 삭제한다(features/task-standards/model/task-standards.repository.server.ts의 deleteDepartment).

Schema: public
Table: standard_categories
Purpose: 게시글 구분자(업무기준/시공기준/기타 등, 색상 포함). 코딩연습 standards_bot.js의 categories 테이블을 이관한 구조.
Columns:
  id bigint (identity)
  name text
  color text (기본 '#6b7280')
  sort_order int
  created_at timestamptz
Primary key: id
Foreign keys: 없음
Indexes: 없음(테이블 크기가 작아 근거 부족, monitoring candidate)
Unique constraints: standard_categories_name_key (name)
RLS policies: RLS enabled. standard_categories_no_direct_access(전체 거부, anon/authenticated).
RPC/functions: 없음
Related APIs: apps/web/app/routes/standards.tsx (loader/action, intent=category.*)
Related frontend screens: /standards (구분자 탭바 + 구분자 관리 모달)
Migration file: supabase/migrations/20260710090000_task_standards.sql
Notes: 삭제 시 해당 구분자 게시글은 category_id=NULL로 정리한다.

Schema: public
Table: standard_posts
Purpose: 부서별 업무기준 게시글(본사 기준·공지 메일 파싱 결과). 코딩연습 standards_bot.js의 standards 테이블을 이관한 구조. mail_archive의 emails와 달리 원본 .eml 전체는 저장하지 않고 첨부파일만 개별 추출해 storage에 저장한다(첨부 목록/개별 다운로드 UI가 필요하기 때문).
Columns:
  id uuid
  title text
  department_id bigint (FK, on delete set null)
  category_id bigint (FK, on delete set null)
  sender_email text
  sender_name text
  sent_at timestamptz
  body_html text
  body_text text
  content_hash text        -- sha256(title|senderEmail|sentAt|bodyText), 중복 업로드 방지
  created_by text
  updated_by text
  created_at timestamptz
  updated_at timestamptz
Primary key: id
Foreign keys: department_id -> standard_departments(id) on delete set null, category_id -> standard_categories(id) on delete set null
Indexes: standard_posts_department_id_idx, standard_posts_category_id_idx, standard_posts_sent_at_idx (sent_at desc)
Unique constraints: standard_posts_content_hash_key (content_hash, nullable unique)
RLS policies: RLS enabled. standard_posts_no_direct_access(전체 거부, anon/authenticated) — emails 테이블과 동일 접근 방식.
RPC/functions: 없음
Related APIs: apps/web/app/routes/standards.tsx (loader: listPosts, action: post.bulkUpdate/post.bulkDelete/department.*/category.*), apps/web/app/routes/standards-new.tsx (action: EML 파싱 후 insertPost), apps/web/app/routes/standards-detail.tsx (loader/action: meta.update/attachment.*/post.delete) — apps/web/app/features/task-standards/model/task-standards.repository.server.ts를 직접 호출
Related frontend screens: /standards, /standards/new, /standards/:postId
Migration file: supabase/migrations/20260710090000_task_standards.sql
Notes:
  - created_by/updated_by는 emails 테이블과 동일하게 seedMembers(인메모리)의 member id를 저장한 text 컬럼이다.
  - 검색은 title/body_text에 대한 ilike이며 별도 full-text index는 없다(현재 게시글 규모에서는 불필요, 필요 시 monitoring candidate).

Schema: public
Table: standard_attachments
Purpose: standard_posts에 종속된 첨부파일 메타. 실제 파일 바이너리는 Storage 버킷 task-standards에 저장한다.
Columns:
  id uuid
  post_id uuid (FK, on delete cascade)
  filename text
  storage_path text
  mime_type text
  created_at timestamptz
Primary key: id
Foreign keys: post_id -> standard_posts(id) on delete cascade
Indexes: standard_attachments_post_id_idx
Unique constraints: 없음
RLS policies: RLS enabled. standard_attachments_no_direct_access(전체 거부, anon/authenticated).
RPC/functions: 없음
Related APIs: apps/web/app/features/task-standards/model/task-standards.repository.server.ts (addAttachment/deleteAttachment/getAttachmentDownloadUrl)
Related frontend screens: /standards/:postId (첨부 목록/추가/삭제), /standards/new (업로드 시 EML 첨부 자동 추출)
Migration file: supabase/migrations/20260710090000_task_standards.sql
Notes:
  - post 삭제 시 on delete cascade로 attachment row는 자동 삭제되지만, storage 파일은 앱 코드(deletePost)에서 별도로 제거한다.
  - Storage 버킷 task-standards는 mail-archive와 동일하게 private(public=false)이며 서버가 service role key로만 업로드하고 다운로드는 signed URL(TTL 300초)로 발급한다.
  - 코딩연습/standards.db(레거시 SQLite)의 실제 데이터(게시글 167건, 부서 29개, 구분자 3개, 첨부 482개/약 399MB)를 이 스키마로 옮기는 scripts/migrate-task-standards.mjs를 준비해두었다. 실행은 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 자격증명이 준비된 이후 별도로 진행한다(2026-07-10 기준 미실행).
```
