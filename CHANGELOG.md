# CHANGELOG

이 저장소(`woomi-coding-agent-template`)의 표준 버전별 변경 기록이다.

**규칙**: 저장소의 공통 규칙, `.agents/*` 문서, `apps/*` 스캐폴드/코드, 훅에 영향을 주는 변경이 생기면 같은 작업에서 이 파일에 항목을 추가하고, `AGENTS.md`와 `README.md`의 "표준 버전"·"최종 수정일"을 함께 갱신한다. 자세한 기준은 [`AGENTS.md`](./AGENTS.md) 10장(Versioning & Changelog)을 따른다.

버전 형식은 `MAJOR.MINOR-단계`다. 새 기능·스캐폴드·규칙 추가는 MINOR를, 호환이 깨지는 표준 변경은 MAJOR를 올리며, 정식 확정 전에는 `-draft`를 유지한다.

---

## [2.3-draft] - 2026-07-10

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
