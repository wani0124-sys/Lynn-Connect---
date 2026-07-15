# Lynn-Connect

건축기획팀(본사)와 현장간 중요 정보를 교환하는 사내 서비스입니다.

이 저장소는 Woomi 바이브 코딩 표준 템플릿(AI 에이전트 규칙, 문서, 프롬프트, 스킬, 훅 묶음) 위에서 개발합니다. 프로젝트 배경·핵심 기능·권한 구조 같은 실제 제품 정보는 [`AGENTS.md`의 "Lynn-Connect Project Override"](./AGENTS.md#lynn-connect-project-override) 섹션을 참고하세요.

적용 중인 템플릿 기준:

- 표준 버전: `2.5-draft`
- 최종 수정일: 2026-07-13
- 기준 레퍼런스: CTPA Hono Worker layered architecture
- 기본 대상: React Router v7 + Hono/Cloudflare Worker + Supabase PostgreSQL 프로젝트

---

## 목적

- 프로젝트마다 코드 구조와 품질 기준이 흔들리는 문제를 줄입니다.
- AI 에이전트가 임의 패턴으로 코드를 생성하는 것을 막습니다.
- 비개발자, 개발자, AI 에이전트가 같은 문서를 보고 작업하게 합니다.
- 아키텍처, 기술스택, 워크플로우, 배포, DB 변경 기준을 프로젝트 시작 시점부터 고정합니다.

---

## 핵심 원칙

`AGENTS.md`가 1차 소스입니다.

Claude Code, Codex, GitHub Copilot 전용 문서와 명령은 모두 `AGENTS.md`와 `.agents/` 하위 문서를 보조합니다. 도구별 문서에만 중요한 규칙을 숨기지 않습니다.

표준 제공 문서는 고정된 절대 규칙이 아니라 **새 프로젝트의 출발 템플릿**입니다. 프로젝트에 적용할 때는 실제 코드, 프레임워크, 배포 방식, API 계약, 디자인 시스템을 확인한 뒤 프로젝트에 맞게 수정해야 합니다.

---

## 실행 방법

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

브라우저에서 `http://localhost:5173/login`을 연 뒤 계정으로 로그인할 수 있습니다.

계정은 더 이상 코드에 고정된 데모 비밀번호가 아니라 Supabase `members` 테이블에서 관리합니다(비밀번호는 scrypt로 해시해 저장). 이 저장소는 public이라 실제 비밀번호는 README에 적지 않습니다 — 로그인 정보는 팀 관리자에게 별도로 문의하세요. 계정 생성/수정/삭제는 로그인 후 `/members`(멤버 관리) 화면에서 본사 권한 계정으로 할 수 있습니다.

---

## 현재 화면/기능 상태

`apps/web`는 React Router v7 + TanStack Query + Zustand + React Hook Form + Zod + Tailwind v4 스택 위에서 개발 중입니다.

| 화면 | 상태 | 설명 |
|---|---|---|
| `/standards` (부서별 업무기준) | **실제 기능** | 본사 기준·공지 메일(.eml)을 업로드·파싱해 부서(2단계 계층)/구분자(색상)별로 정리하고 현장과 공유. Supabase에 저장. |
| `/sites` (현장 점검) | **실제 기능** | 현장 목록을 상단 탭으로 전환하며(페이지 이동 없음), 선택한 현장이 받은 대외 점검(관공서·감리단·발주처·자체점검 등) 이력을 점검명/결과/점검취지/점검내용/지적사항/첨부파일과 함께 관리. 점검 제목을 클릭하면 상세 내용이 그 자리에서 펼쳐짐. |
| `/documents` (문서 관리) | **실제 기능** | 문서 시리즈 목록을 상단 탭으로 전환하며(페이지 이동 없음), 반복 개정되는 회사 표준 PDF 문서(체크리스트 등)를 리비전 단위로 관리하고 직전 리비전과 텍스트 줄 단위 diff를 자동 계산해 보여줌. |
| `/members` (멤버 관리) | **실제 기능** | 계정(본사관리자/현장관리자) 생성·수정·삭제와 현장별 관리 권한을 Supabase `members` 테이블 기반으로 관리. 비밀번호는 scrypt 해시로 저장. |
| `/settings` (설정) | **부분 실제 기능** | "메뉴 관리" 탭은 사이드바 메뉴의 제목·순서·상위/하위 그룹·배치(주 메뉴/관리 메뉴)를 Supabase 기반으로 관리하는 실제 기능(본사 권한 전용). 프로필/알림/계정 초기화 탭은 아직 템플릿이 제공하는 placeholder입니다. |
| `/` 대시보드 | **부분 스캐폴드** | 부서별 업무기준·현장 점검·문서 관리 요약 위젯이 실제로 연결돼 있고, 나머지 KPI/최근 활동 영역은 제거했습니다. |

화면별 라우트/파일 매핑과 커스터마이즈 방법은 [`apps/web/README.md`](./apps/web/README.md)를, 제공 컴포넌트 목록은 [`.agents/ui/COMPONENTS.md`](./.agents/ui/COMPONENTS.md)를 참고하세요.

---

## 문서 지도

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | 모든 에이전트가 먼저 읽는 공통 진입 규칙 + Lynn-Connect Project Override(실제 제품 정보) |
| `CLAUDE.md` | Claude Code 전용 보충 규칙 |
| `CODEX.md` | Codex 전용 보충 규칙 |
| `.agents/ARCHITECTURE.md` | 표준 아키텍처와 레이어 경계 |
| `.agents/STACK.md` | 표준 기술스택 |
| `.agents/WORKFLOW.md` | 작업, PR, push, 리뷰 흐름 |
| `.agents/DEPLOYMENT.md` | Cloudflare/Wrangler/GitHub Actions 배포 기준 |
| `.agents/TOOLING.md` | MCP, 브라우저 자동화, 외부 도구 사용 기준 |
| `.agents/code/*` | 코드 구조, API, 테스트, 에러 처리 기준 |
| `.agents/data/*` | 도메인 모델, DB schema, API 계약, migration 기록 |
| `.agents/ui/*` | 디자인, UX, 컴포넌트 기준 |
| `.agents/examples/*` | 좋은 예시와 금지 예시 |
| `.userdocs/*` | 템플릿 설계 과정에서 만든 참고 문서. 모든 프로젝트에 반드시 복사할 필요는 없음 |
| `CHANGELOG.md` | 표준 버전별 변경 기록 |

---

## 디렉토리 구조

```txt
.
├── AGENTS.md
├── CLAUDE.md
├── CODEX.md
├── .agents/
│   ├── ARCHITECTURE.md
│   ├── STACK.md
│   ├── WORKFLOW.md
│   ├── DEPLOYMENT.md
│   ├── TOOLING.md
│   ├── code/
│   ├── data/
│   ├── ui/
│   └── examples/
├── .claude/
│   ├── commands/
│   ├── skills/
│   └── settings.json
├── .codex/
│   ├── prompts/
│   ├── skills/
│   └── hooks.json
├── .github/
│   ├── prompts/
│   └── instructions/
├── .githooks/
├── .userdocs/              # 참고 문서와 설계 기록
├── apps/
│   └── web/                # React Router v7 앱 (실제 서비스 코드)
├── supabase/
│   └── migrations/         # DB schema/RLS migration
└── scripts/                 # 데이터 이관 등 1회성 스크립트
```

---

## 개발 환경 설정

> **비개발자라면 먼저 [`QUICKSTART.md`](./QUICKSTART.md)를 보세요.** 복사-붙여넣기 한 번으로 AI가 온보딩을 주도하는 프롬프트가 들어 있습니다.

새로 이 저장소를 clone했다면:

1. `pnpm install`로 의존성을 설치합니다.
2. `apps/web/.env.example`을 참고해 `apps/web/.env`를 만들고 Supabase 자격증명을 채웁니다.
3. Git hook을 사용할 경우 아래를 실행합니다.

```bash
git config core.hooksPath .githooks
```

Windows에서도 Git Bash 또는 WSL을 쓰면 같은 명령을 사용할 수 있습니다.

Windows PowerShell에서 한국어 문서를 확인할 때는 UTF-8 인코딩을 명시합니다.

```powershell
Get-Content -Raw -Encoding UTF8 AGENTS.md
Get-Content -Raw -Encoding UTF8 .agents\WORKFLOW.md
```

---

## 에이전트 읽기 순서

작업 전 기본 순서:

1. `AGENTS.md`
2. `AGENTS.md`의 `Task Routing` 표에서 작업 유형 확인
3. 필요한 `.agents/*` 문서만 확인
4. 실제 코드와 설정 파일 확인
5. 해당 도구의 command/prompt/skill 확인

`WORKFLOW.md`는 모든 작업의 상시 필독 문서가 아니라, 큰 기능, PR/push, 리뷰, 배포, DB/API 계약 변경처럼 절차가 중요한 작업에서 읽습니다.

도구별 추가 문서:

- Claude Code: `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`
- Codex: `CODEX.md`, `.codex/prompts/`, `.codex/skills/`
- GitHub Copilot: `.github/prompts/`, `.github/instructions/`

---

## 하네스 계층

이 템플릿은 AI 에이전트가 안전하게 반복 작업을 수행하도록 4계층 하네스를 둡니다.

| 계층 | 역할 | 위치 |
|---|---|---|
| Commands/Prompts | 반복 작업 명령 | `.claude/commands/`, `.codex/prompts/`, `.github/prompts/` |
| Skills | 복잡 작업 체크리스트 | `.claude/skills/`, `.codex/skills/`, `.github/instructions/` |
| Rules | 공통 규칙 | `AGENTS.md`, `.agents/` |
| Hooks | 위험 행동 차단 | `.claude/settings.json`, `.codex/hooks.json`, `.githooks/` |

`main` 브랜치 직접 push는 `.githooks/pre-push`로 차단됩니다. 저장소를 clone한 뒤 위 "개발 환경 설정"의 `git config core.hooksPath .githooks`를 실행해야 로컬에도 적용됩니다. GitHub 쪽에서 강제하려면 Settings → Branches에서 `main`에 "Require a pull request before merging" 규칙을 추가하세요.

---

## 절대 금지

- 실제 secret이 들어간 `.env` 커밋
- service role key 프론트엔드 노출
- 사용자 승인 없는 자동 배포
- 사용자 승인 없는 `git commit`, `git push`, `git pull`
- 운영 DB destructive migration 자동 실행
- 템플릿 규칙을 실제 프로젝트 코드보다 우선해 강제 적용

---

## 운영 방식

이 템플릿은 한 번 작성하고 끝나는 문서가 아닙니다.

프로젝트에서 반복 실수가 발견되면 `.agents/examples/BAD_EXAMPLES.md`에 남기고, 좋은 패턴이 굳어지면 `.agents/examples/GOOD_EXAMPLES.md`에 남깁니다. 스택, 배포, DB, API 계약이 바뀌면 관련 `.agents/*` 문서를 같은 작업에서 갱신합니다.
