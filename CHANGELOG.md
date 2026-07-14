# CHANGELOG

이 저장소(`woomi-coding-agent-template`)의 표준 버전별 변경 기록이다.

**규칙**: 저장소의 공통 규칙, `.agents/*` 문서, `apps/*` 스캐폴드/코드, 훅에 영향을 주는 변경이 생기면 같은 작업에서 이 파일에 항목을 추가하고, `AGENTS.md`와 `README.md`의 "표준 버전"·"최종 수정일"을 함께 갱신한다. 자세한 기준은 [`AGENTS.md`](./AGENTS.md) 10장(Versioning & Changelog)을 따른다.

버전 형식은 `MAJOR.MINOR-단계`다. 새 기능·스캐폴드·규칙 추가는 MINOR를, 호환이 깨지는 표준 변경은 MAJOR를 올리며, 정식 확정 전에는 `-draft`를 유지한다.

---

## [2.5-draft] - 2026-07-13

### 추가
- **문서 리비전 관리** (`/documents`, `/documents/:seriesId`) — "현장 주요 업무 체크리스트"처럼 반복 개정되며 현장에 공지하는 PDF 문서를 시리즈(문서명)·리비전(Rev.0, Rev.1, ...) 단위로 관리한다. 새 리비전을 업로드하면 PDF에서 텍스트를 추출(`pdf-parse`)해 직전 리비전과 줄 단위 diff(`diff` 패키지, `diffLines`)를 자동 계산·저장하고, 상세 화면에서 추가·삭제된 줄을 색으로 구분해 펼쳐볼 수 있다. `entities/document`, `features/documents`로 구성.
- DB: `document_series`/`document_revisions` 테이블과 `document-revisions` storage 버킷 (`supabase/migrations/20260713100000_document_revisions.sql`). **주의**: 이 migration도 아직 실제 Supabase 프로젝트에 적용되지 않았다 — Supabase SQL Editor에서 직접 실행해야 `/documents` 화면이 정상 동작한다.
- 신규 의존성: `pdf-parse`(PDF 텍스트 추출, pdfjs-dist 기반), `diff`(텍스트 diff).
- 사이드바 네비게이션에 "문서 관리" 메뉴 추가.

### 알려진 제약
- diff는 PDF에서 추출한 순수 텍스트를 줄 단위로 비교하는 방식이다. 표(셀) 구조까지 인식해 "이 항목의 이 컬럼만 바뀌었다"는 식으로 정밀하게 비교하지는 못한다 — PDF마다 표 렌더링 구조가 달라 셀 단위 파싱은 안정적으로 만들기 어렵다고 판단해 범위에서 제외했다(사용자 확인 후 진행).
- 리비전 수정(edit) API는 없다. 잘못 업로드한 리비전은 삭제 후 재업로드한다.
- 문서 시리즈 생성·리비전 업로드는 본사(admin/manager) 전용이다. 읽기는 로그인한 모든 사용자에게 열려 있다.

---

## [2.4-draft] - 2026-07-13

### 추가
- **현장 점검 이력 관리** (`/sites`, `/sites/:siteId`) — 현장(공사현장) 목록을 관리하고, 현장이 받는 대외 점검(관공서·감리단·발주처·자체점검 등) 기록을 점검명/점검기관/점검일/결과(적합·부적합·시정조치)/다음 점검 예정일/재점검 여부/비고/첨부파일과 함께 남긴다. `entities/site`, `features/sites`로 구성. `AGENTS.md` Project Override 핵심 기능 2번(점검 보고서)을 구현했다.
- DB: `sites`/`site_inspections`/`site_inspection_attachments` 테이블과 `site-inspections` storage 버킷 (`supabase/migrations/20260713090000_site_inspections.sql`). **주의**: 이 migration은 아직 실제 Supabase 프로젝트에 적용되지 않았다 — Supabase SQL Editor 등에서 직접 실행해야 `/sites` 화면이 정상 동작한다.
- 대시보드에 "현장 점검" 위젯 추가 — 현장 카드(최대 6개)를 클릭하면 해당 현장의 점검 이력 화면으로 이동.
- 사이드바 네비게이션에 "현장 점검" 메뉴 추가.

### 제거
- **전국 날씨 위젯**(대시보드) 전체 삭제 — `features/weather/`, `.env.example`의 `KMA_SERVICE_KEY`. 본사↔현장 정보 공유라는 프로젝트 목적과 무관하다는 판단에 따라 현장 점검 위젯으로 대체했다.

### 변경 — 현장 점검 쓰기 권한을 본사 전용에서 "현장은 자기 현장만" 으로 전환
- `entities/member`: `Member`에 `siteId`(계정 1개 = 현장 1곳) 추가, `canWriteSite(user, siteId)` 헬퍼 추가 — 본사는 모든 현장에, 현장 계정은 자신이 소속된 현장에만 쓸 수 있다. 읽기는 기존과 동일하게 로그인한 모든 사용자에게 열려 있다(본사·타 현장 자료 열람 가능).
- `features/auth/model/session.server.ts`: `requireSiteWriteAccess(request, siteId)` 추가. `/sites/:siteId`의 점검 기록 추가·삭제 action이 `requireHeadquarters` 대신 이 헬퍼를 쓰도록 변경.
- 현장(공사현장) 카탈로그 자체의 추가·수정·삭제(`/sites`의 "현장 관리")는 계속 본사(admin/manager) 전용이다 — 바뀐 것은 "점검 기록" 작성 권한뿐이다.
- 데모 계정 `member@woomi.dev`의 `siteId`를 1로 임시 지정했다(신규 `sites` 테이블은 id 1부터 시작). 다른 현장을 먼저 만들면 이 값을 실제 현장 id에 맞게 조정해야 한다. `/members`에는 아직 siteId를 배정하는 UI가 없다(스캐폴드 상태) — 지금은 `entities/member/model/member.ts`를 직접 수정해서 배정한다.

---

## [2.3-draft] - 2026-07-10

### 문서 (2026-07-13)
- 루트 `README.md`를 실제 프로젝트 현황에 맞게 갱신 — 템플릿 소개 중심에서 Lynn-Connect 현재 화면/기능 상태(부서별 업무기준=실제, 대시보드/항목/구성원/설정=스캐폴드, 점검 보고서=미착수) 안내로 재구성. `apps/web/README.md`의 화면 지도 표에 누락돼 있던 `/standards`, `/standards/new`, `/standards/:postId` 라우트를 추가.

### 추가
- **부서별 업무기준 게시판** (`/standards`, `/standards/new`, `/standards/:postId`) — 본사 기준·공지 메일(.eml)을 업로드하면 파싱해 부서(2단계 계층)/구분자(색상)별로 정리하는 게시판. `entities/task-standard`, `features/task-standards`로 구성. `코딩연습`(레거시 Express+SQLite 앱)의 `/standards` 기능을 Supabase 기반으로 포팅했다.
- DB: `standard_departments`/`standard_categories`/`standard_posts`/`standard_attachments` 테이블과 `task-standards` storage 버킷 (`supabase/migrations/20260710090000_task_standards.sql`).
- 공용 UI `shared/ui/tabs.tsx`, `shared/ui/modal.tsx`, `shared/ui/sortable-list.tsx`(드래그 정렬, `@dnd-kit`) 추가.
- 부서/구분자 관리 모달에 드래그 정렬, EML 업로드에 드래그&드롭 존 적용.
- 레거시 `standards.db` 실데이터(부서 29, 구분자 3, 게시글 167, 첨부파일 482개) 이관 스크립트 `scripts/migrate-task-standards.mjs`(Node 내장 `node:sqlite` 사용) 작성 및 실행 완료.

### 제거
- **메일 아카이브** 기능 전체 삭제 (`routes/mails.tsx`, `mail-new.tsx`, `mail-detail.tsx`, `features/mail-archive/`, `entities/mail/`, `emails` 테이블, `mail-archive` storage 버킷). 부서별 업무기준이 동일한 EML 저장/공유 기능을 상위 호환하면서 대체한다. 제거 마이그레이션: `supabase/migrations/20260710120000_drop_mail_archive.sql`.

### 변경
- `AGENTS.md` Lynn-Connect Project Override의 핵심 기능 목록에서 "메일 아카이빙" 항목을 "기준 문서 관리(부서별 업무기준)"에 통합.

## [2.2-draft] - 2026-07-06

### 추가
- **쿠키 세션 기반 데모 로그인 흐름** — React Router v7 loader/action으로 동작. `/login` action이 Zod 검증 + 데모 자격증명 대조 후 서명 쿠키 세션 발급, `/logout` 세션 파기, 인증 필요한 화면은 loader의 `requireUser`로 가드.
- 더미 계정 시드(`entities/member`)와 서버 전용 자격증명(`features/auth/model/credentials.server.ts`). 관리자 계정 `admin@woomi.dev / admin1234` 포함, 로그인 화면에 데모 계정 안내 표시.
- 상단바에 로그인 사용자 표시 + 로그아웃 버튼, 대시보드 인사말.

### 변경
- `/members`가 시드 계정과 연동되어 현재 로그인 사용자를 표시하고, "로그인 계정은 구성원 화면에서 관리"하도록 안내.
- 로그인 폼을 React Hook Form 클라이언트 제출에서 React Router `Form` + 서버 action 검증으로 전환.
- `apps/web/README.md`에 로그인/인증 섹션과 `/logout` 화면 추가.

## [2.1-draft] - 2026-07-06

### 추가
- `apps/web` 실행 가능한 **관리자 SaaS 스캐폴드** — React Router v7 Framework Mode(SSR) + TanStack Query + Zustand + React Hook Form + Zod + Tailwind CSS v4. 로그인, 대시보드, 항목 목록/상세, 구성원, 설정 화면과 loading/empty/error/403/404 상태 포함. 비개발자가 화면을 미리 보며 "어디에 무엇을 넣을지" 정하도록 도메인 중립 placeholder로 구성.
- 공통 UI 컴포넌트 17종 (`apps/web/app/shared/ui/*`, `apps/web/app/entities/item`).
- `CHANGELOG.md`와 버전 기록 규칙 도입 — `AGENTS.md` 10장, `CLAUDE.md`/`CODEX.md` Updating Rules, Claude Stop 리마인드 훅(`.claude/settings.json`).

### 변경
- `.agents/ui/COMPONENTS.md`에 제공 공통 컴포넌트 등록.
- 루트 `README.md`에 "미리 보는 웹 스캐폴드" 안내와 문서 지도에 `CHANGELOG.md` 추가.
- `.gitignore`에 `.react-router/`(React Router typegen 산출물) 추가.

## [2.0-draft] - 2026-05-28

- AI 에이전트 표준 템플릿 문서 세트 기준선(`AGENTS.md`, `.agents/*`, 도구별 문서 `CLAUDE.md`/`CODEX.md`, 훅). 이후 QUICKSTART 프롬프트, 컴포넌트 생성·DB 마이그레이션 스킬 문서 등이 보강되었으나 별도 버전 스탬프 없이 반영되었다(이 CHANGELOG 도입 이전).
