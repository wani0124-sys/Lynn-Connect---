# API_CONTRACT.md

이 문서는 프로젝트의 API 요청/응답 계약을 진행 중에 정리하는 문서다.

API가 실제로 생기기 전까지는 비워둘 수 있다. endpoint, request, response, error, permission이 바뀌면 같은 작업에서 갱신한다.

---

## 작성 시점

- 새 API endpoint가 추가될 때
- request/response 구조가 바뀔 때
- error code 또는 사용자 메시지가 바뀔 때
- 인증/권한 조건이 바뀔 때
- 프론트엔드 API client, TanStack Query hook, form schema에 영향이 있을 때

---

## 작성할 내용

```txt
Endpoint:
Method:
Purpose:
Auth required:
Allowed roles:
Request params:
Request body:
Response:
Error codes:
Related service:
Related repository:
Related DB tables/RPC:
Related frontend usage:
Notes:
```

---

## API Notes

REST endpoint가 아니라 React Router route module의 loader/action이 계약 역할을 한다 (`apps/worker`가 아직 없어 apps/web 서버에서 직접 처리, `ARCHITECTURE.md`의 mail-archive 노트 참고).

```txt
Route: GET /mails (routes/mails.tsx loader)
Purpose: 메일 아카이브 목록 조회 (최근 200건, created_at desc)
Auth required: 로그인 (requireUser)
Allowed roles: admin/manager/member 전체 조회 가능. canUpload(admin/manager)만 업로드 버튼 노출
Response: { mails: MailListItem[], canUpload: boolean }
Related repository: mail-archive.repository.server.ts#listEmails
Related DB tables: public.emails
Related frontend usage: routes/mails.tsx
Notes: 서버에서 전체 조회 후 프론트 클라이언트 필터(검색어/보관여부). 메일 수가 많아지면 서버 사이드 페이지네이션 필요.

Route: GET/POST /mails/new (routes/mail-new.tsx loader/action)
Purpose: .eml 파일 업로드 → 파싱 → 중복 해시 검사 → Storage 저장 → DB insert
Auth required: 로그인 + 본사 권한 (requireHeadquarters)
Allowed roles: admin, manager
Request body: multipart/form-data { file: File(.eml) }
Response: 성공 시 redirect(/mails/:id). 실패 시 { formError: string } (400)
Error codes: 미지원 확장자/크기 초과, 파싱 실패, "이미 등록된 메일입니다"(content_hash unique 충돌)
Related service/repository: mail-archive.parser.server.ts, mail-archive.repository.server.ts#insertEmail
Related DB tables: public.emails, storage bucket mail-archive
Related frontend usage: routes/mail-new.tsx

Route: GET /mails/:mailId (routes/mail-detail.tsx loader)
Purpose: 메일 상세 조회 + 원본 다운로드용 signed URL(5분 유효) 발급
Auth required: 로그인 (requireUser)
Response: { mail: Mail | null, downloadUrl: string | null, canManage: boolean }
Related repository: mail-archive.repository.server.ts#getEmailById, #getEmlDownloadUrl

Route: POST /mails/:mailId (routes/mail-detail.tsx action, intent=archive|unarchive|delete)
Purpose: 보관 상태 토글, 삭제(DB row + storage object)
Auth required: 로그인 + 본사 권한 (requireHeadquarters)
Allowed roles: admin, manager
Request body: { intent: "archive" | "unarchive" | "delete" }
Response: archive/unarchive는 { ok: true } (같은 라우트 loader 재검증), delete는 redirect(/mails)
Related repository: mail-archive.repository.server.ts#setArchived, #deleteEmail

Route: GET /members (routes/members.tsx loader)
Purpose: 계정(멤버) 목록 + 관리 현장 권한 탭 데이터 조회
Auth required: 로그인 (requireUser)
Allowed roles: admin/manager/member 전체 조회 가능. canManage(admin/manager)만 생성/수정/삭제 UI 노출
Response: { members: Member[], currentUserId: string, sites: Site[], canManage: boolean }
Related repository: members.repository.server.ts#listMembers

Route: POST /members (routes/members.tsx action, intent=member.create|member.bulkCreate|member.update|member.delete|member.bulkDelete|member.updateSitePermission)
Purpose: 계정 생성/일괄 생성/수정/삭제, 관리 현장 권한 수정
Auth required: 로그인 + 본사 권한 (requireHeadquarters)
Allowed roles: admin, manager
Request body: intent별로 name/email/role/position/department/menuPermission/siteId, 또는 id/ids, 또는 managedSiteIds(JSON)
Response: 성공 시 { ok: true }(create/bulkCreate는 { ok: true, created: CreatedAccount[] } 포함). 실패 시 { error: string }(400)
Error codes: "이미 등록된 이메일입니다.", "소속 현장을 선택하세요.", "본인 계정은 삭제할 수 없습니다." 등
Related repository: members.repository.server.ts#createMember/updateMember/deleteMember/getMemberByEmail/getMemberById
Notes: 계정 생성 시 이메일을 아이디로, credentials.server.ts#DEFAULT_TEMP_PASSWORD("Woomilynn")를 초기 비밀번호로 고정 발급하고 hashPassword로 해시해 password_hash 컬럼에 직접 insert한다. mustChangePassword=true로 최초 로그인 시 /change-password로 강제 이동.

Route: GET/POST /login (routes/login.tsx loader/action)
Purpose: 이메일/비밀번호 로그인
Response: 성공 시 세션 쿠키 설정 + redirect(redirectTo 또는 /). 실패 시 { formError: string }(400)
Related repository: credentials.server.ts#verifyCredentials -> members.repository.server.ts#getMemberCredentialsByEmail

Route: GET/POST /change-password (routes/change-password.tsx loader/action)
Purpose: mustChangePassword=true 계정의 강제 비밀번호 변경
Auth required: 로그인 (requireUser)
Response: 성공 시 redirect(/)
Related repository: credentials.server.ts#setPassword -> members.repository.server.ts#setMemberPasswordHash, members.repository.server.ts#updateMember(mustChangePassword=false)

Route: GET /settings (routes/settings.tsx loader, tab=menu)
Purpose: 사이드바 메뉴 관리 탭 데이터 조회(본사 전용). 일반 탭(프로필/알림/계정)은 아직 스캐폴드(서버 저장 없음)라 별도 API 없음
Auth required: 로그인 (requireUser)
Allowed roles: canManage(admin/manager)만 "메뉴 관리" 탭 노출, 그 외 역할은 menuItems: []
Response: { canManage: boolean, menuItems: SidebarMenuItem[] }
Related repository: sidebar-menu.repository.server.ts#listMenuItems

Route: POST /settings (routes/settings.tsx action, intent=menu.rename|menu.createGroup|menu.deleteGroup|menu.setParent|menu.setPlacement|menu.reorder)
Purpose: 사이드바 메뉴 제목 수정, 그룹 생성/삭제, 상위-하위 이동, 배치(주 메뉴/관리 메뉴) 변경, 순서 변경
Auth required: 로그인 + 본사 권한 (requireHeadquarters)
Allowed roles: admin, manager
Request body: intent별로 id/label/placement, 또는 id/parentId, 또는 items(JSON, [{id, sortOrder}])
Response: 성공 시 { ok: true }. 실패 시 { error: string }(400)
Error codes: "메뉴 제목을 입력하세요.", "그룹 이름을 입력하세요.", DB 트리거 위반 시 "사이드바 메뉴는 2단계까지만 허용됩니다" 등
Related repository: sidebar-menu.repository.server.ts#renameMenuItem/createMenuGroup/deleteMenuGroup/setMenuItemParent/setTopLevelMenuItemPlacement/reorderMenuItems
Notes: 메뉴가 가리키는 route는 5개 고정값(fixed set)이라 이 action으로 새 라우트를 만들 수 없다 — 제목/순서/그룹핑만 변경.

Route: GET / (모든 화면 공통, routes/_app.tsx loader)
Purpose: 로그인 사용자 확인 + 사이드바 렌더용 메뉴 트리 조회(DB 우선, 실패 시 nav.ts 정적 배열로 폴백)
Auth required: 로그인 (requireUser)
Response: { user: Member, primaryNav: RenderNavNode[], secondaryNav: RenderNavNode[] }
Related repository: sidebar-menu.repository.server.ts#listMenuItems, entities/sidebar-menu/lib/build-menu-tree.ts#buildMenuTree
```
