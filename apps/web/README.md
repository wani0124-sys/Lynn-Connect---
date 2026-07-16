# Lynn-Connect web

React Router v7 기반 Lynn-Connect(본사 ↔ 현장 정보 공유 플랫폼) 앱이다. `/standards`(부서별 업무기준)·`/sites`(대외기관 점검)·`/documents`(문서 리비전 관리)·`/members`(멤버 관리)는 실제 구현된 기능이고, `/settings`는 "메뉴 관리" 탭만 실제 기능이며 나머지 탭은 템플릿이 제공하는 placeholder다. `/work-orders`는 사이드바 메뉴/라우트만 있는 스캐폴드로, 실제 기능은 추후 구현 예정이다.

---

## 실행

저장소 루트에서 실행한다.

```bash
pnpm install
pnpm dev
```

브라우저에서 http://localhost:5173 를 연다.

기타 스크립트:

```bash
pnpm build       # 프로덕션 빌드
pnpm start       # 빌드 결과 실행
pnpm typecheck   # 타입 검사
```

---

## 스택

- **React Router v7** (Framework Mode, SSR)
- **TanStack Query** — 서버 상태/캐시 (로딩·에러 상태 시연)
- **Zustand** — 클라이언트 UI 상태 (사이드바 접힘, 모바일 드로어)
- **React Hook Form + Zod** — 폼과 검증
- **Tailwind CSS v4** — 시맨틱 토큰 기반 스타일

스택 상세와 선택 기준은 [`../../.agents/STACK.md`](../../.agents/STACK.md)를 참고한다.

---

## 화면 지도

| 경로 | 파일 | 목적 | 상태 |
| --- | --- | --- | --- |
| `/login` | `app/routes/login.tsx` | 로그인 (앱 셸 밖 독립 화면) | 실제 |
| `/logout` | `app/routes/logout.tsx` | 로그아웃 (세션 파기 후 로그인으로) | 실제 |
| `/change-password` | `app/routes/change-password.tsx` | 최초 로그인 시 강제 비밀번호 변경 | 실제 |
| `/sites/:siteId/inspections/:inspectionId/print` | `app/routes/inspection-print.tsx` | 현장 점검 결과보고 양식 인쇄 전용 화면(새 탭) | 실제 |
| `/` | `app/routes/dashboard.tsx` | 대시보드 — 부서별 업무기준·현장 점검·문서 관리 요약 위젯 | 부분 실제 |
| `/standards` | `app/routes/standards.tsx` | 부서별 업무기준 목록 — 부서/구분자 탭, 검색, 일괄 수정·삭제 | 실제 |
| `/standards/new` | `app/routes/standards-new.tsx` | EML 업로드 | 실제 |
| `/standards/:postId` | `app/routes/standards-detail.tsx` | 업무기준 상세 — 본문, 첨부파일, 제목/부서/구분자 수정 | 실제 |
| `/sites` | `app/routes/sites.tsx` | 대외기관 점검 — "점검 프로세스"(고정 안내)/"현장 점검결과"(현장별 이력·인쇄)/"AI 분석"(Claude 문답) 상위 탭 | 실제 |
| `/work-orders` | `app/routes/work-orders.tsx` | 작업지시서 — 메뉴/라우트만 있는 스캐폴드 | 스캐폴드 |
| `/documents` | `app/routes/documents.tsx` | 문서 관리 — 시리즈 탭 전환, 리비전 이력·diff·첨부파일(메인+서브) | 실제 |
| `/members` | `app/routes/members.tsx` | 멤버 관리 — 계정 생성·수정·삭제, 현장별 관리 권한 | 실제 |
| `/settings` | `app/routes/settings.tsx` | 설정 — "메뉴 관리" 탭(실제), 프로필/알림/계정 탭(placeholder) | 부분 실제 |
| `/forbidden` | `app/routes/forbidden.tsx` | 접근 거부 화면 | 실제 |
| `*` | `app/routes/$.tsx` | 404 (없는 주소) | 실제 |

인증된 화면은 공통 셸 `app/routes/_app.tsx`(사이드바 + 상단바) 안에서 렌더된다. 셸 loader가 `requireUser`로 로그인 여부를 확인하고, 미인증이면 `/login?redirectTo=...`로 리다이렉트한다.

---

## 로그인 / 인증

쿠키 세션 기반 인증이 구성되어 있다. React Router v7의 loader/action으로 동작한다.

- 로그인: `/login`의 `action`이 입력을 Zod로 검증하고 Supabase `members` 테이블의 계정 정보(`features/auth/model/credentials.server.ts`)와 대조한다. 비밀번호는 scrypt로 해시해 저장하며, 성공하면 서명된 쿠키 세션(`features/auth/model/session.server.ts`)을 만들고 원래 가려던 경로로 이동한다.
- 가드: 인증이 필요한 route loader에서 `requireUser(request)`를 호출한다. 미인증이면 로그인으로 리다이렉트된다.
- 로그아웃: 상단바 우측 로그아웃 버튼이 `/logout`으로 POST하여 세션을 파기한다.

계정은 더 이상 코드에 고정된 데모 값이 아니라 Supabase `members` 테이블에서 관리한다. 이 저장소는 public이라 실제 로그인 정보는 여기에 적지 않는다 — 필요하면 팀 관리자에게 문의한다. 계정 생성·수정·삭제는 로그인 후 본사 권한 계정으로 `/members`(멤버 관리) 화면에서 할 수 있다.

- 세션 시크릿 → `SESSION_SECRET` 환경변수. 미설정 시 개발용 기본값이 쓰이며, 운영 배포 전 반드시 설정한다.

---

## 화면 상태 기준

목록/상세 화면은 happy path만 만들지 않고 loading / empty / error / 권한 없음 상태를 모두 갖춘다. 새 화면을 만들 때 `/sites`, `/documents`의 기존 구현을 참고한다. 기준은 [`../../.agents/ui/UX_RULES.md`](../../.agents/ui/UX_RULES.md)를 따른다.

---

## 폴더 구조

```
app/
  routes/     # 라우트(화면). react-router의 loader/컴포넌트
  features/   # 화면 단위 기능. auth(로그인), task-standards(업무기준), sites(현장/점검/AI 문답), documents(문서 리비전), members(멤버 관리), sidebar-menu(메뉴 관리) 등
  entities/   # 도메인 모델·도메인 UI. task-standard, site, document, member, sidebar-menu
  shared/     # 공통 UI·유틸·설정·스토어
    ui/       # 재사용 컴포넌트 (Button, Card, Table ...)
    lib/      # cn, format, supabase/anthropic 클라이언트 등 유틸
    config/   # nav(DB 조회 실패 시 폴백) 등 설정
    store/    # zustand 스토어
```

구조 규칙과 배치 기준은 [`../../.agents/ARCHITECTURE.md`](../../.agents/ARCHITECTURE.md)와 [`../../.agents/code/PROJECT_STRUCTURE.md`](../../.agents/code/PROJECT_STRUCTURE.md)를 따른다. 공통 컴포넌트 목록은 [`../../.agents/ui/COMPONENTS.md`](../../.agents/ui/COMPONENTS.md)에 정리돼 있다.

---

## 커스터마이즈

- **색상 / 테마**: `app/app.css`의 `@theme` 시맨틱 토큰을 수정한다. 컴포넌트는 `bg-primary`, `text-muted-foreground` 같은 토큰만 사용하므로 토큰 값만 바꾸면 전체 톤이 바뀐다. 하드코딩 색상은 쓰지 않는다.
- **네비게이션**: 실제 사이드바 메뉴는 Supabase `sidebar_menu_items` 테이블에서 관리하며 `/settings`의 "메뉴 관리" 탭(본사 권한)에서 편집한다. `app/shared/config/nav.ts`의 `navItems`는 DB 조회 실패 시에만 쓰이는 폴백이다.
- **브랜드명 / 메타**: `app/root.tsx`의 `meta`, 셸의 브랜드 텍스트를 수정한다.
