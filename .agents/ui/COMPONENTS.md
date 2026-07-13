# COMPONENTS.md

이 문서는 프로젝트에서 반복 사용되는 UI 컴포넌트와 사용 기준을 진행 중에 정리하는 문서다.

프로젝트 시작 시 모든 컴포넌트를 미리 정의하지 않는다. 실제 화면 구현 중 공통화된 컴포넌트만 추가한다.

---

## 작성 시점

- 같은 UI 패턴이 두 번 이상 반복될 때
- 공통 버튼, 입력, 테이블, 다이얼로그, 배지, 카드, 레이아웃 컴포넌트가 생길 때
- 특정 컴포넌트 사용법을 AI가 반복해서 틀릴 때
- deprecated된 컴포넌트나 대체 컴포넌트가 생길 때

---

## 작성할 내용

```txt
Component:
Location:
Purpose:
When to use:
When not to use:
Required props:
Common variants:
Accessibility notes:
Mobile notes:
Examples:
Deprecated alternatives:
```

---

## Component Notes

이 컴포넌트들은 `apps/web` 스캐폴드에서 제공된다. 위치 규칙은 PROJECT_STRUCTURE.md를 따른다.

| 컴포넌트 | 위치 | 용도 | 주요 props | 상태·접근성 메모 |
| --- | --- | --- | --- | --- |
| Button | `app/shared/ui/button.tsx` | 액션 버튼 | `variant?: primary\|secondary\|outline\|ghost\|danger`, `size?: sm\|md\|lg\|icon`, 나머지 `<button>` 속성 | `focus-visible` 링, `disabled` 시 흐림. 아이콘 버튼은 `size="icon"` + `aria-label` |
| Input | `app/shared/ui/input.tsx` | 단일 행 입력 | native `<input>` 속성 | 오류는 `aria-invalid`로 표시(`aria-[invalid=true]` 시 danger 테두리) |
| Textarea | `app/shared/ui/textarea.tsx` | 여러 행 입력 | native `<textarea>` 속성 | 오류는 `aria-invalid`로 표시 |
| Select | `app/shared/ui/select.tsx` | 드롭다운 선택 | native `<select>` 속성 | `focus-visible` 링, `disabled` 지원 |
| Checkbox | `app/shared/ui/checkbox.tsx` | 체크박스 | native `<input>` 속성(type 고정) | 라벨과 함께 사용. `focus-visible` 링 |
| Card 계열 | `app/shared/ui/card.tsx` | 콘텐츠 묶음 컨테이너 | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `rounded-lg` 고정. 카드 안 카드 중첩 금지 |
| Badge | `app/shared/ui/badge.tsx` | 상태·라벨 표기 | `tone?: neutral\|primary\|success\|warning\|danger\|info` | 시맨틱 토큰 톤만 사용. 텍스트 대비 유지 |
| Table 계열 | `app/shared/ui/table.tsx` | 표 데이터 | `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` | `Table`이 가로 스크롤 래퍼 제공. 행 hover 강조 |
| Skeleton | `app/shared/ui/skeleton.tsx` | 로딩 자리표시 | className으로 크기 지정 | 로딩 상태 전용. `animate-pulse` |
| Field | `app/shared/ui/field.tsx` | 폼 필드 래퍼 | `{ label, htmlFor?, required?, hint?, error?, children }` | `error` 우선 표시, 없으면 `hint`. `htmlFor`로 라벨 연결 |
| PageHeader | `app/shared/ui/page-header.tsx` | 화면 제목·액션 영역 | `{ title, description?, actions? }` | 반응형(모바일 세로 / 데스크톱 가로 정렬) |
| StatCard | `app/shared/ui/stat-card.tsx` | KPI 지표 카드 | `{ label, value, icon?, delta?: { value, trend } }` | `trend`(up/down/flat)에 따라 시맨틱 색 |
| EmptyState | `app/shared/ui/empty-state.tsx` | 빈 상태·무결과 안내 | `{ icon?, title, description?, action? }` | 목록 비었을 때/검색 무결과에 사용 |
| ErrorState | `app/shared/ui/error-state.tsx` | 오류 상태 | `{ title?, description?, onRetry?, action? }` | `onRetry` 있으면 다시 시도 버튼. 루트 ErrorBoundary에서도 사용 |
| Placeholder | `app/shared/ui/placeholder.tsx` | 스캐폴드 가이드 블록 | `{ title, description?, icon? }` | 점선 안내. 실제 위젯으로 교체 대상 |
| ConfirmPanel | `app/shared/ui/confirm-panel.tsx` | 파괴적 작업 확인 | `{ title, description, confirmLabel?, cancelLabel?, onConfirm, onCancel, pending? }` | 삭제/초기화 전 인라인 확인. `pending` 시 처리 중 표시 |
| ItemStatusBadge | `app/entities/item/ui/item-status-badge.tsx` | 항목 상태 배지(도메인) | `{ status: ItemStatus }` | 상태→톤 매핑 내장(active/pending/archived). Badge 기반 |
