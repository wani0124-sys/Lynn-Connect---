import { randomUUID } from "node:crypto"
import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import { formatSenderName } from "~/entities/task-standard/lib/format-sender-name"
import type {
  SiteMailAttachment,
  SiteMailPost,
  SiteMailPostListItem,
  SiteMailPostListResult,
  SiteMailPostSort,
} from "~/entities/site-mail/model/site-mail.types"
import type { ParsedStandard } from "~/features/task-standards/model/task-standards.parser.server"
import { listSiteMailCategories } from "~/features/site-mails/model/site-mail-categories.repository.server"

const TABLE_POSTS = "site_mail_posts"
const TABLE_ATTACHMENTS = "site_mail_attachments"
const BUCKET = "site-mails"
const SIGNED_URL_TTL_SECONDS = 300

interface PostRow {
  id: string
  site_id: number
  title: string
  category_id: number | null
  sender_email: string | null
  sender_name: string | null
  sent_at: string | null
  body_html: string | null
  body_text: string | null
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

interface AttachmentRow {
  id: string
  filename: string
  mime_type: string | null
}

function toAttachment(row: AttachmentRow): SiteMailAttachment {
  return { id: row.id, filename: row.filename, mimeType: row.mime_type }
}

function toPost(row: PostRow, attachments: AttachmentRow[]): SiteMailPost {
  return {
    id: row.id,
    siteId: row.site_id,
    title: row.title,
    categoryId: row.category_id,
    senderEmail: row.sender_email,
    senderName: formatSenderName(row.sender_name),
    sentAt: row.sent_at,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    attachments: attachments.map(toAttachment),
  }
}

// standard_attachments와 동일한 이유(한글/공백/특수문자 파일명은 storage key로 직접 쓸 수 없음)로
// storage_path에는 확장자만 남기고 원본 파일명은 filename 컬럼에만 보존한다.
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[a-zA-Z0-9]+$/)
  return match ? match[0] : ""
}

function escapeOrValue(value: string): string {
  return value.replace(/,/g, "\\,")
}

// ── 게시글 목록 ───────────────────────────────────────────────
export interface ListSiteMailPostsParams {
  siteId: number
  categoryId?: string
  search?: string
  sort?: SiteMailPostSort
  page?: number
  limit?: number
}

async function getAttachmentCounts(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (postIds.length === 0) return counts

  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_ATTACHMENTS)
    .select("post_id")
    .in("post_id", postIds)
  if (error) throw new Error(`첨부파일 수를 확인하지 못했습니다: ${error.message}`)

  for (const row of (data as { post_id: string }[]) ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1)
  }
  return counts
}

export async function listSiteMailPosts(params: ListSiteMailPostsParams): Promise<SiteMailPostListResult> {
  const { siteId, categoryId, search, sort = "sent_desc", page = 1, limit = 30 } = params
  const supabase = getSupabaseServerClient()

  let query = supabase
    .from(TABLE_POSTS)
    .select("id, site_id, title, category_id, sender_name, sent_at, created_at", { count: "exact" })
    .eq("site_id", siteId)

  if (categoryId === "null") {
    query = query.is("category_id", null)
  } else if (categoryId) {
    query = query.eq("category_id", Number(categoryId))
  }

  if (search?.trim()) {
    const escaped = escapeOrValue(search.trim())
    query = query.or(`title.ilike.%${escaped}%,body_text.ilike.%${escaped}%`)
  }

  const ascending = sort === "sent_asc" || sort === "created_asc"
  if (sort === "created_desc" || sort === "created_asc") {
    query = query.order("created_at", { ascending })
  } else {
    query = query.order("sent_at", { ascending, nullsFirst: false }).order("created_at", { ascending })
  }

  const offset = (page - 1) * limit
  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) throw new Error(`게시글 목록을 불러오지 못했습니다: ${error.message}`)

  const rows =
    (data as Pick<PostRow, "id" | "site_id" | "title" | "category_id" | "sender_name" | "sent_at" | "created_at">[]) ?? []
  const [categories, attachmentCounts] = await Promise.all([listSiteMailCategories(siteId), getAttachmentCounts(rows.map((row) => row.id))])
  const catMap = new Map(categories.map((cat) => [cat.id, cat]))

  const listItems: SiteMailPostListItem[] = rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    title: row.title,
    categoryId: row.category_id,
    senderName: formatSenderName(row.sender_name),
    sentAt: row.sent_at,
    createdAt: row.created_at,
    categoryName: row.category_id ? (catMap.get(row.category_id)?.name ?? null) : null,
    categoryColor: row.category_id ? (catMap.get(row.category_id)?.color ?? null) : null,
    attachmentCount: attachmentCounts.get(row.id) ?? 0,
  }))

  return { rows: listItems, total: count ?? 0, page, limit }
}

export async function getSiteMailPostById(id: string): Promise<SiteMailPost | null> {
  const supabase = getSupabaseServerClient()
  const { data: postRow, error } = await supabase.from(TABLE_POSTS).select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`게시글을 불러오지 못했습니다: ${error.message}`)
  if (!postRow) return null

  const { data: attachmentRows, error: attError } = await supabase
    .from(TABLE_ATTACHMENTS)
    .select("id, filename, mime_type")
    .eq("post_id", id)
  if (attError) throw new Error(`첨부파일 목록을 불러오지 못했습니다: ${attError.message}`)

  return toPost(postRow as PostRow, (attachmentRows as AttachmentRow[]) ?? [])
}

export async function findSiteMailByContentHash(siteId: number, contentHash: string): Promise<{ id: string; title: string } | null> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_POSTS)
    .select("id, title")
    .eq("site_id", siteId)
    .eq("content_hash", contentHash)
    .maybeSingle()
  if (error) throw new Error(`중복 여부를 확인하지 못했습니다: ${error.message}`)
  return data
}

interface InsertSiteMailPostInput {
  siteId: number
  parsed: ParsedStandard
  categoryId: number | null
  createdBy: string
}

// task-standards.repository.server.ts#insertPost와 동일한 upload-then-insert-with-cleanup 패턴.
export async function insertSiteMailPost(input: InsertSiteMailPostInput): Promise<SiteMailPost> {
  const supabase = getSupabaseServerClient()
  const postId = randomUUID()
  const uploadedPaths: string[] = []
  const attachmentRows: { id: string; filename: string; storage_path: string; mime_type: string | null }[] = []

  for (const att of input.parsed.attachments) {
    const attachmentId = randomUUID()
    const storagePath = `posts/${postId}/${attachmentId}${getFileExtension(att.filename)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, att.content, { contentType: att.mimeType ?? undefined, upsert: false })
    if (uploadError) {
      if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths)
      throw new Error(`첨부파일(${att.filename}) 저장에 실패했습니다: ${uploadError.message}`)
    }
    uploadedPaths.push(storagePath)
    attachmentRows.push({ id: attachmentId, filename: att.filename, storage_path: storagePath, mime_type: att.mimeType })
  }

  const { data: postRow, error: insertError } = await supabase
    .from(TABLE_POSTS)
    .insert({
      id: postId,
      site_id: input.siteId,
      title: input.parsed.title,
      category_id: input.categoryId,
      sender_email: input.parsed.senderEmail,
      sender_name: input.parsed.senderName,
      sent_at: input.parsed.sentAt,
      body_html: input.parsed.bodyHtml,
      body_text: input.parsed.bodyText,
      content_hash: input.parsed.contentHash,
      created_by: input.createdBy,
    })
    .select("*")
    .single()

  if (insertError) {
    if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths)
    if (insertError.code === "23505") {
      const existing = await findSiteMailByContentHash(input.siteId, input.parsed.contentHash)
      throw new Error(`이미 등록된 메일입니다${existing ? ` (제목: "${existing.title}")` : ""}.`)
    }
    throw new Error(`게시글 저장에 실패했습니다: ${insertError.message}`)
  }

  if (attachmentRows.length) {
    const { error: attInsertError } = await supabase.from(TABLE_ATTACHMENTS).insert(
      attachmentRows.map((row) => ({
        id: row.id,
        post_id: postId,
        filename: row.filename,
        storage_path: row.storage_path,
        mime_type: row.mime_type,
      })),
    )
    if (attInsertError) throw new Error(`첨부파일 정보를 저장하지 못했습니다: ${attInsertError.message}`)
  }

  return toPost(postRow as PostRow, attachmentRows.map((row) => ({ id: row.id, filename: row.filename, mime_type: row.mime_type })))
}

export async function updateSiteMailPostMeta(
  id: string,
  fields: {
    categoryId?: number | null
    title?: string
    bodyText?: string
    bodyHtml?: string | null
  },
  updatedBy: string,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_by: updatedBy, updated_at: new Date().toISOString() }
  if ("categoryId" in fields) updates.category_id = fields.categoryId
  if ("title" in fields) updates.title = fields.title
  if ("bodyText" in fields) updates.body_text = fields.bodyText
  if ("bodyHtml" in fields) updates.body_html = fields.bodyHtml

  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).update(updates).eq("id", id)
  if (error) throw new Error(`게시글 정보를 수정하지 못했습니다: ${error.message}`)
}

// siteId로 대상을 한 번 더 좁혀서, 다른 현장 소속 게시글 id가 섞여 들어와도 그 행은 조용히 무시된다
// (요청 측 siteId 위조로 다른 현장 데이터를 건드리지 못하게 하는 방어선).
export async function bulkUpdateSiteMailPostMeta(
  siteId: number,
  ids: string[],
  fields: { categoryId?: number | null },
  updatedBy: string,
): Promise<void> {
  if (!ids.length) return
  const updates: Record<string, unknown> = { updated_by: updatedBy, updated_at: new Date().toISOString() }
  if ("categoryId" in fields) updates.category_id = fields.categoryId

  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).update(updates).eq("site_id", siteId).in("id", ids)
  if (error) throw new Error(`게시글 정보를 일괄 수정하지 못했습니다: ${error.message}`)
}

async function removePostAttachmentFiles(postIds: string[]): Promise<void> {
  if (!postIds.length) return
  const supabase = getSupabaseServerClient()
  const { data } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").in("post_id", postIds)
  const paths = ((data as { storage_path: string }[]) ?? []).map((row) => row.storage_path)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

export async function deleteSiteMailPost(id: string): Promise<void> {
  await removePostAttachmentFiles([id])
  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).delete().eq("id", id)
  if (error) throw new Error(`게시글 삭제에 실패했습니다: ${error.message}`)
}

export async function bulkDeleteSiteMailPosts(siteId: number, ids: string[]): Promise<void> {
  if (!ids.length) return
  const supabase = getSupabaseServerClient()
  const { data: targetRows, error: targetError } = await supabase
    .from(TABLE_POSTS)
    .select("id")
    .eq("site_id", siteId)
    .in("id", ids)
  if (targetError) throw new Error(`게시글을 확인하지 못했습니다: ${targetError.message}`)
  const targetIds = ((targetRows as { id: string }[]) ?? []).map((row) => row.id)
  if (!targetIds.length) return

  await removePostAttachmentFiles(targetIds)
  const { error } = await supabase.from(TABLE_POSTS).delete().in("id", targetIds)
  if (error) throw new Error(`게시글을 일괄 삭제하지 못했습니다: ${error.message}`)
}

// ── 첨부파일 ─────────────────────────────────────────────────
export async function addSiteMailAttachment(
  postId: string,
  file: { filename: string; mimeType: string | null; content: Buffer },
): Promise<SiteMailAttachment> {
  const supabase = getSupabaseServerClient()
  const attachmentId = randomUUID()
  const storagePath = `posts/${postId}/${attachmentId}${getFileExtension(file.filename)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.content, { contentType: file.mimeType ?? undefined, upsert: false })
  if (uploadError) throw new Error(`첨부파일 저장에 실패했습니다: ${uploadError.message}`)

  const { error } = await supabase
    .from(TABLE_ATTACHMENTS)
    .insert({ id: attachmentId, post_id: postId, filename: file.filename, storage_path: storagePath, mime_type: file.mimeType })

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(`첨부파일 정보를 저장하지 못했습니다: ${error.message}`)
  }
  return { id: attachmentId, filename: file.filename, mimeType: file.mimeType }
}

export async function renameSiteMailAttachment(id: string, filename: string): Promise<void> {
  const { error } = await getSupabaseServerClient().from(TABLE_ATTACHMENTS).update({ filename }).eq("id", id)
  if (error) throw new Error(`첨부파일 이름을 수정하지 못했습니다: ${error.message}`)
}

export async function deleteSiteMailAttachment(id: string): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: row } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").eq("id", id).maybeSingle()

  const { error } = await supabase.from(TABLE_ATTACHMENTS).delete().eq("id", id)
  if (error) throw new Error(`첨부파일 삭제에 실패했습니다: ${error.message}`)

  if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path])
}

export async function getSiteMailAttachmentDownloadUrl(id: string): Promise<{ url: string; filename: string } | null> {
  const supabase = getSupabaseServerClient()
  const { data: row, error } = await supabase
    .from(TABLE_ATTACHMENTS)
    .select("storage_path, filename")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`첨부파일 정보를 불러오지 못했습니다: ${error.message}`)
  if (!row) return null

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)
  if (urlError || !data) throw new Error(`다운로드 링크 생성에 실패했습니다: ${urlError?.message ?? "unknown error"}`)
  return { url: data.signedUrl, filename: row.filename }
}

// 첨부 -> 메일 -> 현장 id. 첨부 다운로드 권한 확인용.
export async function getSiteMailAttachmentSiteId(id: string): Promise<number | null> {
  const supabase = getSupabaseServerClient()
  const { data: att, error } = await supabase.from(TABLE_ATTACHMENTS).select("post_id").eq("id", id).maybeSingle()
  if (error) throw new Error(`첨부파일 정보를 불러오지 못했습니다: ${error.message}`)
  if (!att) return null
  const { data: post, error: postError } = await supabase.from(TABLE_POSTS).select("site_id").eq("id", att.post_id).maybeSingle()
  if (postError) throw new Error(`게시글 정보를 불러오지 못했습니다: ${postError.message}`)
  return post ? (post.site_id as number) : null
}

export async function getSiteMailAttachmentFile(
  id: string,
): Promise<{ blob: Blob; mimeType: string | null; filename: string } | null> {
  const supabase = getSupabaseServerClient()
  const { data: row, error } = await supabase
    .from(TABLE_ATTACHMENTS)
    .select("storage_path, filename, mime_type")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`첨부파일 정보를 불러오지 못했습니다: ${error.message}`)
  if (!row) return null

  const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(row.storage_path)
  if (downloadError || !data)
    throw new Error(`첨부파일을 불러오지 못했습니다: ${downloadError?.message ?? "unknown error"}`)
  return { blob: data, mimeType: row.mime_type, filename: row.filename }
}
