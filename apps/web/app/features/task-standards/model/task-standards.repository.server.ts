import { randomUUID } from "node:crypto"
import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type {
  StandardAttachment,
  StandardCategory,
  StandardDepartment,
  StandardPost,
  StandardPostListItem,
  StandardPostListResult,
  StandardPostSort,
} from "~/entities/task-standard/model/task-standard.types"
import type { ParsedStandard } from "~/features/task-standards/model/task-standards.parser.server"

const TABLE_DEPARTMENTS = "standard_departments"
const TABLE_CATEGORIES = "standard_categories"
const TABLE_POSTS = "standard_posts"
const TABLE_ATTACHMENTS = "standard_attachments"
const BUCKET = "task-standards"
const SIGNED_URL_TTL_SECONDS = 300

interface DepartmentRow {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
}

interface CategoryRow {
  id: number
  name: string
  color: string
  sort_order: number
}

interface PostRow {
  id: string
  title: string
  department_id: number | null
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

function toDepartment(row: DepartmentRow): StandardDepartment {
  return { id: row.id, name: row.name, parentId: row.parent_id, sortOrder: row.sort_order }
}

function toCategory(row: CategoryRow): StandardCategory {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order }
}

function toAttachment(row: AttachmentRow): StandardAttachment {
  return { id: row.id, filename: row.filename, mimeType: row.mime_type }
}

function toPost(row: PostRow, attachments: AttachmentRow[]): StandardPost {
  return {
    id: row.id,
    title: row.title,
    departmentId: row.department_id,
    categoryId: row.category_id,
    senderEmail: row.sender_email,
    senderName: row.sender_name,
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

// 파일명을 storage 경로에 안전하게 쓰기 위해 경로 구분자만 제거한다(원본 파일명은 filename 컬럼에 그대로 보존).
function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\]/g, "_")
}

// PostgREST .or() 필터 문법에서 콤마는 조건 구분자이므로 사용자 입력에 포함되면 이스케이프한다.
function escapeOrValue(value: string): string {
  return value.replace(/,/g, "\\,")
}

// ── 부서 ─────────────────────────────────────────────────────
export async function listDepartments(): Promise<StandardDepartment[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_DEPARTMENTS)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`부서 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as DepartmentRow[]).map(toDepartment)
}

async function getDepartmentAndChildrenIds(departmentId: number): Promise<number[]> {
  const departments = await listDepartments()
  return departments
    .filter((dept) => dept.id === departmentId || dept.parentId === departmentId)
    .map((dept) => dept.id)
}

export async function createDepartment(name: string, parentId: number | null): Promise<StandardDepartment> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE_DEPARTMENTS)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from(TABLE_DEPARTMENTS)
    .insert({ name: name.trim(), parent_id: parentId, sort_order: nextOrder })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 부서명입니다.")
    throw new Error(`부서를 추가하지 못했습니다: ${error.message}`)
  }
  return toDepartment(data as DepartmentRow)
}

export async function renameDepartment(
  id: number,
  name: string,
  parentId: number | null,
): Promise<{ promotedCount: number }> {
  const supabase = getSupabaseServerClient()
  let promotedCount = 0

  // 하위 부서로 이동할 때, 기존 자식 부서는 최상위(루트)로 승격한다(legacy renameDepartment와 동일 규칙).
  if (parentId !== null) {
    const { data: children, error: promoteError } = await supabase
      .from(TABLE_DEPARTMENTS)
      .update({ parent_id: null })
      .eq("parent_id", id)
      .select("id")
    if (promoteError) throw new Error(`하위 부서를 정리하지 못했습니다: ${promoteError.message}`)
    promotedCount = children?.length ?? 0
  }

  const { error } = await supabase
    .from(TABLE_DEPARTMENTS)
    .update({ name: name.trim(), parent_id: parentId })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 부서명입니다.")
    throw new Error(`부서를 수정하지 못했습니다: ${error.message}`)
  }
  return { promotedCount }
}

export async function deleteDepartment(id: number): Promise<{ movedPostCount: number }> {
  const supabase = getSupabaseServerClient()
  const movedPostCount = await getDepartmentPostCount(id)

  const { error: unassignError } = await supabase
    .from(TABLE_POSTS)
    .update({ department_id: null })
    .eq("department_id", id)
  if (unassignError) throw new Error(`게시글의 부서 정보를 정리하지 못했습니다: ${unassignError.message}`)

  const { error } = await supabase.from(TABLE_DEPARTMENTS).delete().eq("id", id)
  if (error) throw new Error(`부서를 삭제하지 못했습니다: ${error.message}`)
  return { movedPostCount }
}

export async function getDepartmentPostCount(id: number): Promise<number> {
  const { count, error } = await getSupabaseServerClient()
    .from(TABLE_POSTS)
    .select("id", { count: "exact", head: true })
    .eq("department_id", id)
  if (error) throw new Error(`부서별 게시글 수를 확인하지 못했습니다: ${error.message}`)
  return count ?? 0
}

export async function reorderDepartments(items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase
      .from(TABLE_DEPARTMENTS)
      .update({ sort_order: item.sortOrder })
      .eq("id", item.id)
    if (error) throw new Error(`부서 순서를 저장하지 못했습니다: ${error.message}`)
  }
}

// ── 구분자 ───────────────────────────────────────────────────
export async function listCategories(): Promise<StandardCategory[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`구분자 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as CategoryRow[]).map(toCategory)
}

export async function createCategory(name: string, color: string): Promise<StandardCategory> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE_CATEGORIES)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 10

  const { data, error } = await supabase
    .from(TABLE_CATEGORIES)
    .insert({ name: name.trim(), color: color || "#6b7280", sort_order: nextOrder })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 구분자입니다.")
    throw new Error(`구분자를 추가하지 못했습니다: ${error.message}`)
  }
  return toCategory(data as CategoryRow)
}

export async function renameCategory(id: number, name: string, color: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE_CATEGORIES)
    .update({ name: name.trim(), color })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 구분자입니다.")
    throw new Error(`구분자를 수정하지 못했습니다: ${error.message}`)
  }
}

export async function deleteCategory(id: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { error: unassignError } = await supabase
    .from(TABLE_POSTS)
    .update({ category_id: null })
    .eq("category_id", id)
  if (unassignError) throw new Error(`게시글의 구분자 정보를 정리하지 못했습니다: ${unassignError.message}`)

  const { error } = await supabase.from(TABLE_CATEGORIES).delete().eq("id", id)
  if (error) throw new Error(`구분자를 삭제하지 못했습니다: ${error.message}`)
}

export async function getCategoryPostCount(id: number): Promise<number> {
  const { count, error } = await getSupabaseServerClient()
    .from(TABLE_POSTS)
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
  if (error) throw new Error(`구분자별 게시글 수를 확인하지 못했습니다: ${error.message}`)
  return count ?? 0
}

export async function reorderCategories(items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase
      .from(TABLE_CATEGORIES)
      .update({ sort_order: item.sortOrder })
      .eq("id", item.id)
    if (error) throw new Error(`구분자 순서를 저장하지 못했습니다: ${error.message}`)
  }
}

// ── 게시글 목록 ───────────────────────────────────────────────
export interface ListPostsParams {
  departmentId?: string
  categoryId?: string
  search?: string
  sort?: StandardPostSort
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

export async function listPosts(params: ListPostsParams = {}): Promise<StandardPostListResult> {
  const { departmentId, categoryId, search, sort = "sent_desc", page = 1, limit = 30 } = params
  const supabase = getSupabaseServerClient()

  let query = supabase
    .from(TABLE_POSTS)
    .select("id, title, department_id, category_id, sender_name, sent_at, created_at", { count: "exact" })

  if (departmentId === "null") {
    query = query.is("department_id", null)
  } else if (departmentId) {
    const deptIds = await getDepartmentAndChildrenIds(Number(departmentId))
    query = query.in("department_id", deptIds.length ? deptIds : [-1])
  }

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

  const rows = (data as Pick<PostRow, "id" | "title" | "department_id" | "category_id" | "sender_name" | "sent_at" | "created_at">[]) ?? []
  const [departments, categories, attachmentCounts] = await Promise.all([
    listDepartments(),
    listCategories(),
    getAttachmentCounts(rows.map((row) => row.id)),
  ])
  const deptMap = new Map(departments.map((dept) => [dept.id, dept]))
  const catMap = new Map(categories.map((cat) => [cat.id, cat]))

  const listItems: StandardPostListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    departmentId: row.department_id,
    categoryId: row.category_id,
    senderName: row.sender_name,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    departmentName: row.department_id ? (deptMap.get(row.department_id)?.name ?? null) : null,
    categoryName: row.category_id ? (catMap.get(row.category_id)?.name ?? null) : null,
    categoryColor: row.category_id ? (catMap.get(row.category_id)?.color ?? null) : null,
    attachmentCount: attachmentCounts.get(row.id) ?? 0,
  }))

  return { rows: listItems, total: count ?? 0, page, limit }
}

export async function getPostById(id: string): Promise<StandardPost | null> {
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

export async function findByContentHash(contentHash: string): Promise<{ id: string; title: string } | null> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_POSTS)
    .select("id, title")
    .eq("content_hash", contentHash)
    .maybeSingle()
  if (error) throw new Error(`중복 여부를 확인하지 못했습니다: ${error.message}`)
  return data
}

interface InsertPostInput {
  parsed: ParsedStandard
  departmentId: number | null
  categoryId: number | null
  createdBy: string
}

// storage 업로드(첨부 전체) 후 게시글/첨부 row를 insert한다. 업로드 후 게시글 insert가 실패하면
// (예: content_hash 중복) 업로드한 파일을 정리한다 - mail-archive.repository.server.ts의
// upload-then-insert-with-cleanup 패턴을 다중 첨부파일로 확장한 형태.
export async function insertPost(input: InsertPostInput): Promise<StandardPost> {
  const supabase = getSupabaseServerClient()
  const postId = randomUUID()
  const uploadedPaths: string[] = []
  const attachmentRows: { id: string; filename: string; storage_path: string; mime_type: string | null }[] = []

  for (const att of input.parsed.attachments) {
    const attachmentId = randomUUID()
    const storagePath = `posts/${postId}/${attachmentId}-${sanitizeFilename(att.filename)}`
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
      title: input.parsed.title,
      department_id: input.departmentId,
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
      const existing = await findByContentHash(input.parsed.contentHash)
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

export async function updatePostMeta(
  id: string,
  fields: { departmentId?: number | null; categoryId?: number | null; title?: string },
  updatedBy: string,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_by: updatedBy, updated_at: new Date().toISOString() }
  if ("departmentId" in fields) updates.department_id = fields.departmentId
  if ("categoryId" in fields) updates.category_id = fields.categoryId
  if ("title" in fields) updates.title = fields.title

  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).update(updates).eq("id", id)
  if (error) throw new Error(`게시글 정보를 수정하지 못했습니다: ${error.message}`)
}

export async function bulkUpdatePostMeta(
  ids: string[],
  fields: { departmentId?: number | null; categoryId?: number | null },
  updatedBy: string,
): Promise<void> {
  if (!ids.length) return
  const updates: Record<string, unknown> = { updated_by: updatedBy, updated_at: new Date().toISOString() }
  if ("departmentId" in fields) updates.department_id = fields.departmentId
  if ("categoryId" in fields) updates.category_id = fields.categoryId

  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).update(updates).in("id", ids)
  if (error) throw new Error(`게시글 정보를 일괄 수정하지 못했습니다: ${error.message}`)
}

async function removePostAttachmentFiles(postIds: string[]): Promise<void> {
  if (!postIds.length) return
  const supabase = getSupabaseServerClient()
  const { data } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").in("post_id", postIds)
  const paths = ((data as { storage_path: string }[]) ?? []).map((row) => row.storage_path)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

export async function deletePost(id: string): Promise<void> {
  await removePostAttachmentFiles([id])
  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).delete().eq("id", id)
  if (error) throw new Error(`게시글 삭제에 실패했습니다: ${error.message}`)
}

export async function bulkDeletePosts(ids: string[]): Promise<void> {
  if (!ids.length) return
  await removePostAttachmentFiles(ids)
  const { error } = await getSupabaseServerClient().from(TABLE_POSTS).delete().in("id", ids)
  if (error) throw new Error(`게시글을 일괄 삭제하지 못했습니다: ${error.message}`)
}

// ── 첨부파일 ─────────────────────────────────────────────────
export async function addAttachment(
  postId: string,
  file: { filename: string; mimeType: string | null; content: Buffer },
): Promise<StandardAttachment> {
  const supabase = getSupabaseServerClient()
  const attachmentId = randomUUID()
  const storagePath = `posts/${postId}/${attachmentId}-${sanitizeFilename(file.filename)}`

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

export async function deleteAttachment(id: string): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: row } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").eq("id", id).maybeSingle()

  const { error } = await supabase.from(TABLE_ATTACHMENTS).delete().eq("id", id)
  if (error) throw new Error(`첨부파일 삭제에 실패했습니다: ${error.message}`)

  if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path])
}

export async function getAttachmentDownloadUrl(id: string): Promise<{ url: string; filename: string } | null> {
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
