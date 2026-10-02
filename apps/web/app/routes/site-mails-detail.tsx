import { useEffect, useRef, useState } from "react"
import {
  Link,
  data,
  redirect,
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router"
import { Check, Download, ExternalLink, List, Paperclip, Pencil, Trash2, Upload, X } from "lucide-react"
import { CategoryBadge } from "~/entities/task-standard/ui/category-badge"
import { requireUser } from "~/features/auth/model/session.server"
import { canViewSiteMail, canWriteSiteMail, requireSiteMailWriteAccess } from "~/features/site-mails/model/site-mail-access.server"
import { getSiteMailSiteById } from "~/features/site-mails/model/site-mail-sites.repository.server"
import {
  addSiteMailAttachment,
  deleteSiteMailAttachment,
  deleteSiteMailPost,
  getSiteMailAttachmentDownloadUrl,
  getSiteMailPostById,
  renameSiteMailAttachment,
  updateSiteMailPostMeta,
} from "~/features/site-mails/model/site-mails.repository.server"
import { assertSiteMailCategory, listSiteMailCategories } from "~/features/site-mails/model/site-mail-categories.repository.server"
import {
  validateAttachmentFile,
  validateAttachmentFilename,
  validateBodyHtml,
  validateBodyText,
  validateTitle,
} from "~/features/task-standards/model/task-standards.schema"
import { formatDateTime } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { EmptyState } from "~/shared/ui/empty-state"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const postId = params.postId ?? ""
  const post = await getSiteMailPostById(postId)
  const site = post ? await getSiteMailSiteById(post.siteId) : null
  // 현장 계정은 담당 현장의 메일만 열람할 수 있다.
  if (site && !canViewSiteMail(user, site)) throw redirect("/forbidden")
  // 구분자는 현장마다 따로이므로 이 메일이 속한 현장의 목록만 보여준다.
  const categories = post ? await listSiteMailCategories(post.siteId) : []

  let attachmentUrls: Record<string, string> = {}
  if (post && post.attachments.length > 0) {
    const entries = await Promise.all(
      post.attachments.map(async (att) => [att.id, (await getSiteMailAttachmentDownloadUrl(att.id))?.url ?? null] as const),
    )
    attachmentUrls = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null))
  }

  return { post, categories, attachmentUrls, canWrite: site ? canWriteSiteMail(user, site) : false }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const postId = params.postId ?? ""
  // 이 라우트의 모든 intent는 같은 postId(URL 파라미터)에 대해 동작하므로, 요청 본문이 아니라
  // 게시글의 실제 소속 현장(site_id)을 기준으로 쓰기 권한을 한 번만 검사한다(클라이언트가 보낸 값을
  // 신뢰하지 않는다). requireSiteMailWriteAccess가 던지는 redirect는 아래 try/catch 밖에서 그대로 전파돼야
  // 하므로(잡히면 안 됨) try 진입 전에 호출한다 — task-standards.detail의 requireHeadquarters 선행 호출과 동일 패턴.
  const existingPost = await getSiteMailPostById(postId)
  if (!existingPost) throw new Response("Not Found", { status: 404 })
  const { user } = await requireSiteMailWriteAccess(request, existingPost.siteId)

  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "meta.update": {
        const categoryIdRaw = form.get("categoryId")
        const titleRaw = form.get("title")
        const bodyTextRaw = form.get("bodyText")
        const bodyHtmlRaw = form.get("bodyHtml")
        const fields: { categoryId?: number | null; title?: string; bodyText?: string; bodyHtml?: string | null } = {}
        if (categoryIdRaw !== null) fields.categoryId = categoryIdRaw ? Number(categoryIdRaw) : null
        if (fields.categoryId !== undefined) await assertSiteMailCategory(existingPost.siteId, fields.categoryId)
        if (titleRaw !== null) {
          const title = String(titleRaw).trim()
          const validationError = validateTitle(title)
          if (validationError) return data({ error: validationError }, { status: 400 })
          fields.title = title
        }
        // bodyText/bodyHtml은 실제로 화면에 표시되던(=수정 대상이던) 쪽만 전달되며, 반대쪽 필드는 건드리지 않는다.
        if (bodyTextRaw !== null) {
          const bodyText = String(bodyTextRaw)
          const validationError = validateBodyText(bodyText)
          if (validationError) return data({ error: validationError }, { status: 400 })
          fields.bodyText = bodyText
        }
        if (bodyHtmlRaw !== null) {
          const bodyHtml = String(bodyHtmlRaw)
          const validationError = validateBodyHtml(bodyHtml)
          if (validationError) return data({ error: validationError }, { status: 400 })
          fields.bodyHtml = bodyHtml
        }
        await updateSiteMailPostMeta(postId, fields, user.id)
        return { ok: true }
      }
      case "attachment.add": {
        const file = form.get("file")
        if (!(file instanceof File) || file.size === 0) return data({ error: "파일을 선택해 주세요." }, { status: 400 })
        const validationError = validateAttachmentFile(file)
        if (validationError) return data({ error: validationError }, { status: 400 })
        const buffer = Buffer.from(await file.arrayBuffer())
        await addSiteMailAttachment(postId, { filename: file.name, mimeType: file.type || null, content: buffer })
        return { ok: true }
      }
      case "attachment.rename": {
        const filename = String(form.get("filename") ?? "").trim()
        const validationError = validateAttachmentFilename(filename)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await renameSiteMailAttachment(String(form.get("id") ?? ""), filename)
        return { ok: true }
      }
      case "attachment.delete": {
        await deleteSiteMailAttachment(String(form.get("id") ?? ""))
        return { ok: true }
      }
      case "post.delete": {
        await deleteSiteMailPost(postId)
        return redirect("/site-mails")
      }
      default:
        return data({ error: "알 수 없는 요청입니다." }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
    return data({ error: message }, { status: 400 })
  }
}

export default function SiteMailsDetailRoute() {
  const { post, categories, attachmentUrls, canWrite } = useLoaderData<typeof loader>()
  const metaFetcher = useFetcher<typeof action>()
  const attachmentFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(post?.title ?? "")
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null)
  const [attachmentFilenameDraft, setAttachmentFilenameDraft] = useState("")
  const [isEditingClassification, setIsEditingClassification] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState(String(post?.categoryId ?? ""))
  const [isEditingBody, setIsEditingBody] = useState(false)
  const [bodyDraft, setBodyDraft] = useState(post?.bodyHtml ?? post?.bodyText ?? "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editableBodyRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setTitleDraft(post?.title ?? "")
  }, [post?.title])

  useEffect(() => {
    setBodyDraft(post?.bodyHtml ?? post?.bodyText ?? "")
  }, [post?.bodyHtml, post?.bodyText])

  useEffect(() => {
    setCategoryDraft(String(post?.categoryId ?? ""))
  }, [post?.categoryId])

  if (!post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title="게시글을 찾을 수 없습니다."
          description="삭제되었거나 잘못된 주소입니다."
          action={
            <Link to="/site-mails">
              <Button variant="outline">목록으로</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  const currentCategory = post.categoryId ? (categories.find((c) => c.id === post.categoryId) ?? null) : null
  const actionError =
    (metaFetcher.data && "error" in metaFetcher.data && metaFetcher.data.error) ||
    (attachmentFetcher.data && "error" in attachmentFetcher.data && attachmentFetcher.data.error) ||
    null

  function submitAttachmentFile(file: File | undefined) {
    if (!file) return
    const formData = new FormData()
    formData.append("intent", "attachment.add")
    formData.append("file", file)
    attachmentFetcher.submit(formData, { method: "post", encType: "multipart/form-data" })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const cancelTitleEdit = () => {
    setTitleDraft(post.title)
    setIsEditingTitle(false)
  }

  const saveTitleEdit = () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === post.title) {
      cancelTitleEdit()
      return
    }
    metaFetcher.submit({ intent: "meta.update", title: trimmed }, { method: "post" })
    setIsEditingTitle(false)
  }

  const startRenameAttachment = (attachmentId: string, currentFilename: string) => {
    setEditingAttachmentId(attachmentId)
    setAttachmentFilenameDraft(currentFilename)
  }

  const cancelRenameAttachment = () => {
    setEditingAttachmentId(null)
    setAttachmentFilenameDraft("")
  }

  const saveRenameAttachment = (attachmentId: string, currentFilename: string) => {
    const trimmed = attachmentFilenameDraft.trim()
    if (!trimmed || trimmed === currentFilename) {
      cancelRenameAttachment()
      return
    }
    attachmentFetcher.submit({ intent: "attachment.rename", id: attachmentId, filename: trimmed }, { method: "post" })
    setEditingAttachmentId(null)
  }

  const cancelClassificationEdit = () => {
    setCategoryDraft(String(post.categoryId ?? ""))
    setIsEditingClassification(false)
  }

  const saveClassificationEdit = () => {
    const currentCatValue = String(post.categoryId ?? "")
    if (categoryDraft === currentCatValue) {
      cancelClassificationEdit()
      return
    }
    metaFetcher.submit({ intent: "meta.update", categoryId: categoryDraft }, { method: "post" })
    setIsEditingClassification(false)
  }

  // bodyHtml이 있으면 화면에는 항상 HTML이 렌더링되므로, 수정도 렌더링된 화면(iframe designMode)에서 직접 한다.
  const bodyIsHtml = Boolean(post.bodyHtml)

  const startBodyEdit = () => {
    setBodyDraft(post.bodyHtml ?? post.bodyText ?? "")
    setIsEditingBody(true)
  }

  const cancelBodyEdit = () => {
    setBodyDraft(post.bodyHtml ?? post.bodyText ?? "")
    setIsEditingBody(false)
  }

  const saveBodyEdit = () => {
    if (bodyIsHtml) {
      const editedHtml = editableBodyRef.current?.contentDocument?.documentElement.outerHTML
      if (editedHtml === undefined) {
        cancelBodyEdit()
        return
      }
      metaFetcher.submit({ intent: "meta.update", bodyHtml: editedHtml }, { method: "post" })
    } else {
      const current = post.bodyText ?? ""
      if (bodyDraft === current) {
        cancelBodyEdit()
        return
      }
      metaFetcher.submit({ intent: "meta.update", bodyText: bodyDraft }, { method: "post" })
    }
    setIsEditingBody(false)
  }

  const enableBodyDesignMode = () => {
    const doc = editableBodyRef.current?.contentDocument
    if (doc) doc.designMode = "on"
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitleEdit()
                  if (e.key === "Escape") cancelTitleEdit()
                }}
                maxLength={500}
                className="h-9 max-w-xl text-xl font-semibold"
                aria-label="제목"
              />
              <Button type="button" variant="ghost" size="icon" aria-label="저장" onClick={saveTitleEdit}>
                <Check className="size-4" aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="취소" onClick={cancelTitleEdit}>
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <h1 className="truncate text-xl font-semibold tracking-tight">{post.title}</h1>
              {canWrite ? (
                <Button type="button" variant="ghost" size="icon" aria-label="제목 수정" onClick={() => setIsEditingTitle(true)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {post.senderName ?? "발신자 미상"}
            {post.senderEmail ? ` <${post.senderEmail}>` : ""} · {formatDateTime(post.sentAt ?? post.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite ? (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 aria-hidden />
              삭제
            </Button>
          ) : null}
          <Link to="/site-mails">
            <Button>
              <List aria-hidden />
              목록
            </Button>
          </Link>
        </div>
      </div>

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      {confirmingDelete ? (
        <ConfirmPanel
          title="이 게시글을 삭제할까요?"
          description="첨부파일을 포함해 함께 삭제되며 되돌릴 수 없습니다."
          onConfirm={() => deleteFetcher.submit({ intent: "post.delete" }, { method: "post" })}
          onCancel={() => setConfirmingDelete(false)}
          pending={deleteFetcher.state !== "idle"}
        />
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <CardTitle>본문</CardTitle>
            {canWrite && !isEditingBody ? (
              <Button type="button" variant="ghost" size="icon" aria-label="본문 수정" onClick={startBodyEdit}>
                <Pencil className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
          {canWrite ? (
            isEditingClassification ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={categoryDraft}
                  disabled={metaFetcher.state !== "idle"}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  className="h-8 text-xs"
                  aria-label="구분자"
                >
                  <option value="">구분자 없음</option>
                  {sortedCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="저장"
                  disabled={metaFetcher.state !== "idle"}
                  onClick={saveClassificationEdit}
                >
                  <Check className="size-4" aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="취소" onClick={cancelClassificationEdit}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {currentCategory ? (
                  <CategoryBadge name={currentCategory.name} color={currentCategory.color} />
                ) : (
                  <span className="text-sm text-muted-foreground">구분자 없음</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="분류 수정"
                  onClick={() => setIsEditingClassification(true)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </div>
            )
          ) : null}
        </CardHeader>
        <CardContent>
          {isEditingBody ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {bodyIsHtml
                  ? "아래 화면에서 보이는 내용을 직접 클릭해 수정하세요. 이미지는 그대로 유지됩니다."
                  : "아래 내용을 직접 수정하세요."}
              </p>
              {bodyIsHtml ? (
                <iframe
                  ref={editableBodyRef}
                  title="본문 수정"
                  srcDoc={bodyDraft}
                  sandbox="allow-same-origin"
                  referrerPolicy="no-referrer"
                  onLoad={enableBodyDesignMode}
                  className="h-[480px] w-full rounded-md border border-border bg-white"
                />
              ) : (
                <textarea
                  autoFocus
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelBodyEdit()
                  }}
                  disabled={metaFetcher.state !== "idle"}
                  rows={16}
                  className="h-[480px] w-full resize-y rounded-md border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="본문 내용"
                />
              )}
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="저장"
                  disabled={metaFetcher.state !== "idle"}
                  onClick={saveBodyEdit}
                >
                  <Check className="size-4" aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="취소" onClick={cancelBodyEdit}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ) : post.bodyHtml ? (
            <iframe
              title="메일 본문"
              srcDoc={post.bodyHtml}
              sandbox=""
              referrerPolicy="no-referrer"
              className="h-[480px] w-full rounded-md border border-border bg-white"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground">{post.bodyText || "(본문 없음)"}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>첨부파일 ({post.attachments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {post.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">첨부파일이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {post.attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between gap-2 p-3">
                  {editingAttachmentId === att.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <Input
                        autoFocus
                        value={attachmentFilenameDraft}
                        onChange={(e) => setAttachmentFilenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRenameAttachment(att.id, att.filename)
                          if (e.key === "Escape") cancelRenameAttachment()
                        }}
                        maxLength={255}
                        className="h-8"
                        aria-label="파일 이름"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="저장"
                        onClick={() => saveRenameAttachment(att.id, att.filename)}
                      >
                        <Check className="size-4" aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label="취소" onClick={cancelRenameAttachment}>
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ) : attachmentUrls[att.id] ? (
                    <a
                      href={attachmentUrls[att.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 truncate text-sm hover:underline"
                    >
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {att.filename}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 truncate text-sm">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {att.filename}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    {editingAttachmentId === att.id ? null : (
                      <>
                        {attachmentUrls[att.id] ? (
                          <a href={attachmentUrls[att.id]} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="ghost" size="icon" aria-label="바로 열기">
                              <ExternalLink className="size-4" aria-hidden />
                            </Button>
                          </a>
                        ) : null}
                        <a href={`/site-mails/attachments/${att.id}/download`} download={att.filename}>
                          <Button type="button" variant="ghost" size="icon" aria-label="다운로드">
                            <Download className="size-4" aria-hidden />
                          </Button>
                        </a>
                        {canWrite ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="이름 수정"
                            onClick={() => startRenameAttachment(att.id, att.filename)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        ) : null}
                        {canWrite ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="삭제"
                            disabled={attachmentFetcher.state !== "idle"}
                            onClick={() => attachmentFetcher.submit({ intent: "attachment.delete", id: att.id }, { method: "post" })}
                          >
                            <Trash2 className="size-4 text-danger" aria-hidden />
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canWrite ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => submitAttachmentFile(e.target.files?.[0])}
                className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              />
              {attachmentFetcher.state !== "idle" ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Upload className="size-3" aria-hidden />
                  업로드 중…
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
