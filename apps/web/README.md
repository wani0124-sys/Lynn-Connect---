# Lynn-Connect web

React Router v7 기반 Lynn-Connect(본사 ↔ 현장 정보 공유 플랫폼) 앱이다. Woomi 관리자 SaaS 템플릿에서 시작했으며, `/standards`(부서별 업무기준)와 `/sites`(현장 점검)는 실제 구현된 기능이고 나머지 화면(항목 관리/구성원/설정)은 아직 템플릿이 제공하는 도메인 중립 placeholder다. 실제 도메인에 맞게 순차적으로 교체한다.

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
| `/` | `app/routes/dashboard.tsx` | 대시보드 — 부서별 업무기준·현장 점검 요약 위젯 | 실제 |
| `/standards` | `app/routes/standards.tsx` | 부서별 업무기준 목록 — 부서/구분자 탭, 검색, 일괄 수정·삭제 | 실제 |
| `/standards/new` | `app/routes/standards-new.tsx` | EML 업로드 | 실제 |
| `/standards/:postId` | `app/routes/standards-detail.tsx` | 업무기준 상세 — 본문, 첨부파일, 제목/부서/구분자 수정 | 실제 |
| `/sites` | `app/routes/sites.tsx` | 현장 목록 — 현장별 최근 점검 결과 카드, 현장 관리(추가·수정·삭제·순서) | 실제 |
| `/sites/:siteId` | `app/routes/site-detail.tsx` | 현장 상세 — 대외 점검 이력(점검기관/결과/다음 점검 예정일/첨부) 등록·조회·삭제 | 실제 |
| `/items` | `app/routes/items.tsx` | 항목 목록 — 검색·필터, 상태 미리보기 | 스캐폴드 |
| `/items/:itemId` | `app/routes/item-detail.tsx` | 항목 상세 — 정보와 삭제 확인 | 스캐폴드 |
| `/members` | `app/routes/members.tsx` | 구성원 — 역할·권한 관리 | 스캐폴드 |
| `/settings` | `app/routes/settings.tsx` | 설정 — 프로필, 알림, 위험 구역 | 스캐폴드 |
| `/logout` | `app/routes/logout.tsx` | 로그아웃 (세션 파기 후 로그인으로) | 실제 |
| `/forbidden` | `app/routes/forbidden.tsx` | 접근 거부 화면 | 실제 |
| `*` | `app/routes/$.tsx` | 404 (없는 주소) | 실제 |

인증된 화면은 공통 셸 `app/routes/_app.tsx`(사이드바 + 상단바) 안에서 렌더된다. 셸 loader가 `requireUser`로 로그인 여부를 확인하고, 미인증이면 `/login?redirectTo=...`로 리다이렉트한다.

---

## 로그인 / 인증

쿠키 세션 기반의 데모 인증이 미리 구성되어 있다. React Router v7의 loader/action으로 동작한다.

- 로그인: `/login`의 `action`이 입력을 Zod로 검증하고 데모 자격증명(`features/auth/model/credentials.server.ts`)과 대조한 뒤, 성공하면 서명된 쿠키 세션(`features/auth/model/session.server.ts`)을 만들고 원래 가려던 경로로 이동한다.
- 가드: 인증이 필요한 route loader에서 `requireUser(request)`를 호출한다. 미인증이면 로그인으로 리다이렉트된다.
- 로그아웃: 상단바 우측 로그아웃 버튼이 `/logout`으로 POST하여 세션을 파기한다.

데모 계정 (로그인 화면에도 표시됨):

| 이메일 | 비밀번호 | 역할 |
| --- | --- | --- |
| `admin@woomi.dev` | `admin1234` | 관리자 |
| `manager@woomi.dev` | `manager1234` | 매니저 |
| `member@woomi.dev` | `member1234` | 구성원 |

계정은 `entities/member`의 시드 데이터이며, 로그인 후 **구성원**(`/members`) 화면에서 관리하도록 안내된다. 실제 서비스에서는 아래를 교체한다.

- `credentials.server.ts`의 평문 데모 비밀번호 → 백엔드 인증(해시 저장/검증).
- `entities/member`의 시드 → 실제 DB/API.
- 세션 시크릿 → `SESSION_SECRET` 환경변수. 미설정 시 개발용 기본값이 쓰이며, 운영 배포 전 반드시 설정한다.

---

## 상태 미리보기

`/items` 화면 상단의 세그먼트 컨트롤로 **정상 / 로딩 / 빈 상태 / 오류** 를 즉시 전환하며 확인할 수 있다. 목록 화면은 happy path만 만들지 않고 loading / empty / error / (검색 무결과) 상태를 모두 갖춘다. 새 목록 화면을 만들 때 이 네 가지 상태를 참고한다.

---

## 어디에 무엇을 넣나

- **점선 가이드 블록**(`Placeholder`)은 "여기에 무엇을 배치할지" 알려주는 안내다. 실제 차트·위젯·목록으로 교체한다.
- **샘플 데이터**는 `app/entities/item`의 mock이다. 실제 API 호출과 loader로 교체하고, 응답은 Zod로 검증한다.
- **새 기능**은 `app/features/*`에 추가한다. 폼·인증·필터처럼 화면 단위 기능 로직이 들어간다.
- 화면 상단·본문의 **스캐폴드 안내 배너/문구**는 실제 콘텐츠로 대체하면서 제거한다.

---

## 폴더 구조

```
app/
  routes/     # 라우트(화면). react-router의 loader/컴포넌트
  features/   # 화면 단위 기능. auth(로그인), task-standards(업무기준 업로드·관리), sites(현장/점검 관리) 등
  entities/   # 도메인 모델·mock·도메인 UI. task-standard, site(실제), item(스캐폴드) 등
  shared/     # 공통 UI·유틸·설정·스토어
    ui/       # 재사용 컴포넌트 (Button, Card, Table ...)
    lib/      # cn, format, supabase 클라이언트 등 유틸
    config/   # nav 등 설정
    store/    # zustand 스토어
```

구조 규칙과 배치 기준은 [`../../.agents/ARCHITECTURE.md`](../../.agents/ARCHITECTURE.md)와 [`../../.agents/code/PROJECT_STRUCTURE.md`](../../.agents/code/PROJECT_STRUCTURE.md)를 따른다. 공통 컴포넌트 목록은 [`../../.agents/ui/COMPONENTS.md`](../../.agents/ui/COMPONENTS.md)에 정리돼 있다.

---

## 커스터마이즈

- **색상 / 테마**: `app/app.css`의 `@theme` 시맨틱 토큰을 수정한다. 컴포넌트는 `bg-primary`, `text-muted-foreground` 같은 토큰만 사용하므로 토큰 값만 바꾸면 전체 톤이 바뀐다. 하드코딩 색상은 쓰지 않는다.
- **네비게이션**: `app/shared/config/nav.ts`의 `navItems`를 수정한다. 사이드바·모바일 드로어가 이 목록을 렌더한다.
- **브랜드명 / 메타**: `app/root.tsx`의 `meta`, 셸의 브랜드 텍스트를 수정한다.
