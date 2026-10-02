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
Response: { members: Member[], currentUserId: string, sites: Site[], mailSites: SiteMailSite[], mailSiteIdsByMember: Record<memberId, number[]>, canManage: boolean }
Related repository: members.repository.server.ts#listMembers, site-mail-sites.repository.server.ts#listSiteMailSites/listSiteMailSiteIdsByMember

Route: POST /members (routes/members.tsx action, intent=member.create|member.bulkCreate|member.update|member.delete|member.bulkDelete|member.updateSitePermission)
Purpose: 계정 생성/일괄 생성/수정/삭제, 관리 현장 권한 수정
Auth required: 로그인 + 본사 권한 (requireHeadquarters)
Allowed roles: admin, manager
Request body: intent별로 name/email/role/position/department/menuPermission/siteId/mailSiteId, 또는 id/ids, 또는 managedSiteIds(JSON). siteId는 대외기관 점검 현장(sites), mailSiteId는 현장별 메일함 현장(site_mail_sites)이며 현장관리자는 둘 중 하나 이상 필수(2026-10-02)
Response: 성공 시 { ok: true }(create/bulkCreate는 { ok: true, created: CreatedAccount[] } 포함). 실패 시 { error: string }(400)
Error codes: "이미 등록된 이메일입니다.", "소속 현장을 선택하세요.", "본인 계정은 삭제할 수 없습니다." 등
Related repository: members.repository.server.ts#createMember/updateMember/deleteMember/getMemberByEmail/getMemberById, site-mail-sites.repository.server.ts#setMemberSiteMailSite
Notes: mailSiteId는 site_mail_site_writers(메일함 현장 담당자)로 저장한다. 한 현장에 담당자 여러 명 가능하며 다른 계정의 담당 지정은 건드리지 않는다. 이미 그 현장 담당이면 그대로 두고, 다른 현장을 고르면 그 계정의 담당 현장을 그 하나로 바꾸며, 본사관리자로 바꾸면 담당 지정을 비운다.
 계정 생성 시 이메일을 아이디로, credentials.server.ts#DEFAULT_TEMP_PASSWORD("Woomilynn")를 초기 비밀번호로 고정 발급하고 hashPassword로 해시해 password_hash 컬럼에 직접 insert한다. mustChangePassword=true로 최초 로그인 시 /change-password로 강제 이동.

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

Route: POST /settings (routes/settings.tsx action, intent=menu.rename|menu.createGroup|menu.deleteGroup|menu.createLeaf|menu.deleteLeaf|menu.setParent|menu.setPlacement|menu.reorder)
Purpose: 사이드바 메뉴 제목 수정, 그룹 생성/삭제, 커스텀 하위 메뉴 생성/삭제, 상위-하위 이동, 배치(주 메뉴/관리 메뉴) 변경, 순서 변경
Auth required: 로그인 + 본사 권한 (requireHeadquarters)
Allowed roles: admin, manager
Request body: intent별로 id/label/placement, 또는 id/parentId, 또는 label/parentId/placement(menu.createLeaf), 또는 items(JSON, [{id, sortOrder}])
Response: 성공 시 { ok: true }. 실패 시 { error: string }(400)
Error codes: "메뉴 제목을 입력하세요.", "그룹 이름을 입력하세요.", "하위 메뉴 이름을 입력하세요.", DB 트리거 위반 시 "사이드바 메뉴는 2단계까지만 허용됩니다" 등
Related repository: sidebar-menu.repository.server.ts#renameMenuItem/createMenuGroup/deleteMenuGroup/createMenuLeaf/deleteMenuLeaf/setMenuItemParent/setTopLevelMenuItemPlacement/reorderMenuItems
Notes: 고정 화면의 route 자체(코드/마이그레이션)는 이 action으로 바꿀 수 없다. menu.createLeaf는 아직 실제 화면이 없는 "/menu/<slug>" 커스텀 하위 메뉴를 그룹(parentId) 아래에 만든다(라벨/순서/배치만 관리자가 정하고 route는 서버가 자동 생성). menu.deleteLeaf는 route가 있는 리프 행이면 고정 화면/커스텀 메뉴 구분 없이 삭제한다 — 사이드바 노출만 사라지고 실제 라우트/페이지 코드는 그대로 남는다(그룹은 deleteMenuGroup으로만 삭제 가능).

Route: GET /menu/:slug (routes/menu-placeholder.tsx loader)
Purpose: 관리자가 menu.createLeaf로 만든 커스텀 하위 메뉴가 연결되는 공통 "준비 중" 스캐폴드 화면
Auth required: 로그인 (requireUser)
Response: { menuItem: SidebarMenuItem | null } — null이면 화면에서 "메뉴를 찾을 수 없습니다" EmptyState 표시
Related repository: sidebar-menu.repository.server.ts#findMenuItemByRoute

Route: GET /site-mails (routes/site-mails.tsx loader)
Purpose: 현장별 중요메일 목록 조회(현장 탭 + 구분자 탭 + 검색/정렬/페이지네이션)
Auth required: 로그인 (requireUser)
Allowed roles: 본사(admin/manager)는 모든 현장, 현장(member) 계정은 담당 메일함 현장(site_mail_site_writers)만 탭으로 보이고 조회 가능(canViewSiteMail, 2026-10-02 사용자 요청 "현장은 본인 현장만"). canWrite(canWriteSiteMail: 본사는 전체, 현장은 담당 현장만)만 EML 업로드/일괄 수정·삭제 UI 노출. canWrite인 계정이 선택 현장의 구분자 관리 UI 사용(2026-10-02 현장별 구분자)
Request params: ?site=<id>&cat=<id|null>&q=&sort=sent_desc|sent_asc|created_desc|created_asc&page=
Response: { sites: Site[], selectedSite: Site | null, categories: StandardCategory[](선택 현장 것만), postList: SiteMailPostListResult, canManageSites: boolean, writerCandidates, canWrite: boolean }
Related repository: site-mails.repository.server.ts#listSiteMailPosts, site-mail-sites.repository.server.ts#listSiteMailSites, site-mail-categories.repository.server.ts#listSiteMailCategories

Route: POST /site-mails (routes/site-mails.tsx action, intent=site.*|site.setWriters|category.*|post.bulkUpdate|post.bulkDelete)
Purpose: 현장 관리(메일함 전용 site_mail_sites 추가·수정·삭제·순서 변경·담당자 지정 — /sites의 현장과 연동되지 않음, 2026-10-01), 구분자 관리(메일함 현장별 site_mail_categories — 다른 현장·부서 화면 구분자와 연동되지 않음, 2026-10-02), 선택한 메일 일괄 구분자 적용/삭제
Auth required: site.*는 로그인 + 본사 권한(requireHeadquarters). category.*/post.bulkUpdate/post.bulkDelete는 requireSiteMailWriteAccess(request, siteId)(본사 또는 해당 메일함 현장 담당자)
Request body: site.create/rename은 { name, id? }(주소 없음), site.delete는 { id }, site.reorder는 { items: JSON }, site.setWriters는 { id, memberIds: JSON(string[]) }. category.*는 task-standards의 동일 intent 본문 + { siteId }(필수, 그 현장의 구분자만 수정됨). post.bulkUpdate의 categoryId는 같은 현장 구분자여야 한다(아니면 400). post.bulkUpdate/bulkDelete는 { siteId, ids: JSON, categoryId? }
Response: 성공 시 { ok: true }. 실패 시 { error: string }(400)
Related repository: site-mail-sites.repository.server.ts#createSiteMailSite/renameSiteMailSite/deleteSiteMailSite/reorderSiteMailSites/setSiteMailSiteWriters, site-mail-categories.repository.server.ts#createSiteMailCategory/renameSiteMailCategory/deleteSiteMailCategory/reorderSiteMailCategories, site-mails.repository.server.ts#bulkUpdateSiteMailPostMeta/bulkDeleteSiteMailPosts
Notes: bulk 함수는 update/delete 쿼리 자체를 site_id로도 좁혀서, 요청의 siteId를 통과했더라도 실제로는 다른 현장 소속인 id는 조용히 무시된다.

Route: GET/POST /site-mails/new (routes/site-mails-new.tsx loader/action)
Purpose: .eml 파일 여러 건 업로드(최대 30개) → 파싱 → 현장 단위 중복 해시 검사 → Storage 저장 → DB insert
Auth required: 로그인 + 해당 현장 쓰기 권한(requireSiteWriteAccess, site_id는 request body의 site_id로 조회한 sites row 존재 확인 후 판정)
Request body: multipart/form-data { site_id, eml: File[], category_ids: JSON string[] }
Response: { results: {name, id}[], errors: {name, error}[] }. 폼 자체 오류는 { formError: string }(400)
Error codes: 미지원 확장자/개수/크기 초과, 파싱 실패, "이미 등록된 메일입니다"(site_id+content_hash unique 충돌), "현장을 찾을 수 없습니다."
Related repository: task-standards.parser.server.ts#parseStandardEml(재사용), site-mails.repository.server.ts#findSiteMailByContentHash/insertSiteMailPost

Route: GET /site-mails/:postId (routes/site-mails-detail.tsx loader)
Purpose: 현장 메일 상세 조회 + 첨부파일 signed URL(5분 유효) 발급
Auth required: 로그인 + 이 메일이 속한 현장의 열람 권한(canViewSiteMail — 본사 또는 담당자). 없으면 /forbidden
Response: { post: SiteMailPost | null, categories: StandardCategory[], attachmentUrls: Record<string,string>, canWrite: boolean }
Related repository: site-mails.repository.server.ts#getSiteMailPostById, #getSiteMailAttachmentDownloadUrl

Route: POST /site-mails/:postId (routes/site-mails-detail.tsx action, intent=meta.update|attachment.add|attachment.rename|attachment.delete|post.delete)
Purpose: 제목/구분자/본문 수정, 첨부파일 추가/이름수정/삭제, 게시글 삭제
Auth required: 로그인 + 이 게시글이 속한 현장의 쓰기 권한. params.postId로 게시글을 먼저 조회해 실제 site_id를 기준으로 requireSiteMailWriteAccess를 한 번만 검사한다(요청 본문의 값을 신뢰하지 않음) — 모든 intent가 같은 postId에 대해 동작하므로 action 진입 시 단 한 번만 검사
Response: 성공 시 { ok: true }(post.delete는 redirect(/site-mails)). 실패 시 { error: string }(400)
Related repository: site-mails.repository.server.ts#updateSiteMailPostMeta/addSiteMailAttachment/renameSiteMailAttachment/deleteSiteMailAttachment/deleteSiteMailPost

Route: GET /site-mails/attachments/:attachmentId/download (routes/site-mails-attachment-download.tsx loader)
Purpose: 첨부파일 원본 다운로드(브라우저 저장 강제, Content-Disposition: attachment)
Auth required: 로그인 + 첨부가 속한 메일의 현장 열람 권한(requireSiteMailReadAccess). 없으면 /forbidden
Related repository: site-mails.repository.server.ts#getSiteMailAttachmentSiteId/getSiteMailAttachmentFile

Route: GET / (모든 화면 공통, routes/_app.tsx loader)
Purpose: 로그인 사용자 확인 + 사이드바 렌더용 메뉴 트리 조회(DB 우선, 실패 시 nav.ts 정적 배열로 폴백)
Auth required: 로그인 (requireUser)
Response: { user: Member, primaryNav: RenderNavNode[], secondaryNav: RenderNavNode[] }
Related repository: sidebar-menu.repository.server.ts#listMenuItems, entities/sidebar-menu/lib/build-menu-tree.ts#buildMenuTree
```
