# STACK.md

이 문서는 Woomi 신규 프로젝트의 표준 기술스택을 정의한다. 스택 변경이 필요한 경우 사유와 영향 범위를 문서화한 뒤 합의 후 반영한다.

---

## 1. Frontend

- React
- React Router v7 Framework Mode
- TypeScript
- TanStack Query
- Zustand
- React Hook Form
- Zod
- 프로젝트별 디자인 시스템

신규 프로젝트에서 `React + Vite`만으로 프론트엔드 표준을 끝내지 않는다. React는 UI 라이브러리이고, Vite는 빌드 도구다. Woomi 신규 프로젝트의 기본 프론트엔드 프레임워크는 **React Router v7 Framework Mode**다.

기본 조합:

- Framework: React Router v7 Framework Mode
- Rendering/routing/data boundary: React Router route modules, loader/action, error boundary
- Server state: TanStack Query
- Local/client state: Zustand
- Form: React Hook Form
- Validation: Zod
- API client: 프로젝트 공통 fetch wrapper
- UI: 프로젝트별 디자인 시스템

디자인 시스템이 없는 경우 MUI, Tailwind + shadcn/ui, Radix 기반 컴포넌트 중 하나로 통일한다. 한 프로젝트 안에서 UI 프레임워크를 섞지 않는다.

---

## 2. Frontend State/Data Rules

| 도구 | 담당 | 사용 기준 |
|---|---|---|
| React Router v7 | 라우팅, route loader/action, navigation, error boundary | URL 진입, route 단위 초기 데이터, 간단한 form action |
| TanStack Query | 서버 데이터 캐시/동기화 | 여러 컴포넌트가 공유하거나 갱신/무효화/mutation 동기화가 필요한 API 데이터 |
| Zustand | 클라이언트 UI 상태 | URL로 표현하기 어렵고 여러 화면이 공유하는 UI 상태 |
| React Hook Form | 복잡한 폼 상태 | 동적 필드, 중첩 필드, dirty/touched/errors, 임시 저장이 필요한 폼 |
| Zod | 입력/API 데이터 검증 | form 값, API 요청/응답, shared schema 계약 검증 |

우선순위:

- route 진입에 꼭 필요한 초기 데이터는 React Router `loader`를 우선 고려한다.
- 간단한 제출은 React Router `Form/action`을 우선 고려한다.
- 서버 데이터 캐시, mutation 후 목록 갱신, background refetch가 필요하면 TanStack Query를 사용한다.
- 검색어, 필터, 페이지 번호처럼 URL로 표현 가능한 상태는 URL search params에 둔다.
- 사이드바, 패널 접힘, 현재 선택 컨텍스트처럼 URL로 표현하기 어려운 전역 UI 상태만 Zustand에 둔다.
- 복잡한 업무 입력 폼은 React Hook Form + Zod를 사용한다.

---

## 3. TypeScript

- 제품 코드는 TypeScript를 기본으로 한다.
- 타입은 API 요청/응답, DB row, 권한 role, 도메인 상태값, form 입력값, Worker Env, service binding, `packages/shared` schema 같은 경계에 우선 적용한다.
- 작은 함수 내부 변수, 단순 map/filter 중간값, 명확히 추론되는 값은 TypeScript 추론을 활용한다.
- 복잡한 제네릭, 조건부 타입 남발, 타입 체조는 금지한다.
- 일회성 스크립트, 단순 설정 파일, 버릴 프로토타입은 JavaScript를 허용할 수 있다.

TypeScript `strict mode`는 `tsconfig`의 `"strict": true`를 켜서 더 엄격한 타입 검사를 적용한다는 뜻이다. 대표적으로 `null`/`undefined` 가능성, 암묵적 `any`, 함수 인자/반환 타입 불일치 같은 실수를 빌드 전에 잡는다.

strict mode는 타입을 복잡하게 만들라는 뜻이 아니다. 제품 코드의 경계는 명확히 타입으로 보호하되, 내부 구현은 단순한 타입과 추론을 우선한다.

---

## 4. Backend

- Cloudflare Workers 또는 Cloudflare Pages Functions
- Hono
- TypeScript strict mode
- Zod
- Supabase JS

---

## 5. Database

- Supabase PostgreSQL
- PostgreSQL function/RPC
- RLS가 필요한 서비스는 정책 문서를 반드시 둔다.

### Lynn-Connect 데이터베이스 특수 사항

- **RLS 필수**: 본사 데이터와 현장 데이터를 권한으로 분리
  - 본사(권한: `headquarters`): 모든 메일, 기준, 점검 보고서 열람/작성 권한
  - 현장(권한: `site`): 자신의 점검 보고서만 쓰기, 모든 메일/기준 읽기
- **메일 아카이브 테이블**: `emails` 테이블에 발신자, 제목, 본문, 첨부, 저장일 기록
- **메타데이터**: 각 문서에 `created_by`, `created_at`, `updated_by`, `updated_at` 필수

---

## 6. Storage / Infra

- Cloudflare R2 또는 Supabase Storage
- Cloudflare Cron Triggers 또는 Queue
- Wrangler

---

## 7. Tooling

### Lynn-Connect 도구 추가

- **Gemini API**: 메일 요약/정제용 (mail_bot.js 참고)
- **Supabase Storage**: 첨부 파일, 기준 문서 PDF 저장
- **기존 코드 참고**: `/코딩연습/` 폴더의 `mail_bot.js`, `lynn-mail.html`, `standards_bot.js`

---

## 8. Tooling (기존)

- pnpm workspace
- TypeScript project references
- ESLint
- Prettier
- GitHub Actions
- Wrangler

---

## 8. Add-ons

NestJS를 사용하는 프로젝트는 `.agents/code/NEST_GUIDE.md`와 `.agents/code/NEST_CF_WORKER.md`를 추가로 따른다.
