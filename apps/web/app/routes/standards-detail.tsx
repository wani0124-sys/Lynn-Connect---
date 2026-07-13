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
import { Check, Download, Paperclip, Pencil, Trash2, Upload, X } from "lucide-react"
import { buildDepartmentOptions } from "~/entities/task-standard/lib/build-department-options"
import { isHeadquarters } from "~/entities/member/model/member"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import {
  addAttachment,
  deleteAttachment,
  deletePost,
  getAttachmentDownloadUrl,
  getPostById,
  listCategories,
  listDepartments,
  updatePostMeta,
} from "~/features/task-standards/model/task-standards.repository.server"
import { validateAttachmentFile, validateTitle } from "~/features/task-standards/model/task-standards.schema"
import { formatDateTime } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { EmptyState } from "~/shared/ui/empty-state"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const postId = params.postId ?? ""
  const [post, departments, categories] = await Promise.all([getPostById(postId), listDepartments(), listCategories()])

  let attachmentUrls: Record<string, string> = {}
  if (post && post.attachments.length > 0) {
    const entries = await Promise.all(
      post.attachments.map(async (att) => [att.id, (await getAttachmentDownloadUrl(att.id))?.url ?? null] as const),
    )
    attachmentUrls = Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null))
  }

  return { post, departments, categories, attachmentUrls, canManage: isHeadquarters(user.role) }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireHeadquarters(request)
  const postId = params.postId ?? ""
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "meta.update": {
        const departmentIdRaw = form.get("departmentId")
        const categoryIdRaw = form.get("categoryId")
        const titleRaw = form.get("title")
        const fields: { departmentId?: number | null; categoryId?: number | null; title?: string } = {}
        if (departmentIdRaw !== null) fields.departmentId = departmentIdRaw ? Number(departmentIdRaw) : null
        if (categoryIdRaw !== null) fields.categoryId = categoryIdRaw ? Number(categoryIdRaw) : null
        if (titleRaw !== null) {
          const title = String(titleRaw).trim()
          const validationError = validateTitle(title)
          if (validationError) return data({ error: validationError }, { status: 400 })
          fields.title = title
        }
        await updatePostMeta(postId, fields, user.id)
        return { ok: true }
      }
      case "attachment.add": {
        const file = form.get("file")
        if (!(file instanceof File) || file.size === 0) return data({ error: "파일을 선택해 주세요." }, { status: 400 })
        const validationError = validateAttachmentFile(file)
        if (validationError) return data({ error: validationError }, { status: 400 })
        const buffer = Buffer.from(await file.arrayBuffer())
        await addAttachment(postId, { filename: file.name, mimeType: file.type || null, content: buffer })
        return { ok: true }
      }
      case "attachment.delete": {
        await deleteAttachment(String(form.get("id") ?? ""))
        return { ok: true }
      }
      case "post.delete": {
        await deletePost(postId)
        return redirect("/standards")
      }
      default:
        return data({ error: "알 수 없는 요청입니다." }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
    return data({ error: message }, { status: 400 })
  }
}

export default function StandardsDetailRoute() {
  const { post, departments, categories, attachmentUrls, canManage } = useLoaderData<typeof loader>()
  const metaFetcher = useFetcher<typeof action>()
  const attachmentFetcher = useFetcher<typeof action>()
  const deleteFetcher = useFetcher<typeof action>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(post?.title ?? "")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitleDraft(post?.title ?? "")
  }, [post?.title])

  if (!post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title="게시글을 찾을 수 없습니다."
          description="삭제되었거나 잘못된 주소입니다."
          action={
            <Link to="/standards">
              <Button variant="outline">목록으로</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const departmentOptions = buildDepartmentOptions(departments)
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
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

  return (
    <div className="space-y-6">
      <Link to="/standards" className="text-sm text-muted-foreground hover:text-foreground">
        ← 부서별 업무기준
      </Link>

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
              {canManage ? (
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
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 aria-hidden />
              삭제
            </Button>
          </div>
        ) : null}
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

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>분류</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Field label="부서" htmlFor="departmentId">
              <Select
                id="departmentId"
                defaultValue={post.departmentId ?? ""}
                disabled={metaFetcher.state !== "idle"}
                onChange={(e) =>
                  metaFetcher.submit(
                    { intent: "meta.update", departmentId: e.target.value, categoryId: String(post.categoryId ?? "") },
                    { method: "post" },
                  )
                }
              >
                <option value="">부서 없음</option>
                {departmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="구분자" htmlFor="categoryId">
              <Select
                id="categoryId"
                defaultValue={post.categoryId ?? ""}
                disabled={metaFetcher.state !== "idle"}
                onChange={(e) =>
                  metaFetcher.submit(
                    { intent: "meta.update", departmentId: String(post.departmentId ?? ""), categoryId: e.target.value },
                    { method: "post" },
                  )
                }
              >
                <option value="">구분자 없음</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>본문</CardTitle>
        </CardHeader>
        <CardContent>
          {post.bodyHtml ? (
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
                  <span className="flex items-center gap-2 truncate text-sm">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {att.filename}
                  </span>
                  <div className="flex items-center gap-1">
                    {attachmentUrls[att.id] ? (
                      <a href={attachmentUrls[att.id]} download={att.filename}>
                        <Button type="button" variant="ghost" size="icon" aria-label="다운로드">
                          <Download className="size-4" aria-hidden />
                        </Button>
                      </a>
                    ) : null}
                    {canManage ? (
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
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
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
