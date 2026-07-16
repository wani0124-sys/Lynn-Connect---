import { randomUUID } from "node:crypto"
import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type {
  DiffChunk,
  DocumentRevision,
  DocumentRevisionAttachment,
  DocumentSeries,
  SeriesWithLatestRevision,
} from "~/entities/document/model/document.types"
import { computeLineDiff, extractPdfText } from "~/features/documents/model/documents.parser.server"

const TABLE_SERIES = "document_series"
const TABLE_REVISIONS = "document_revisions"
const TABLE_ATTACHMENTS = "document_revision_attachments"
const BUCKET = "document-revisions"
const SIGNED_URL_TTL_SECONDS = 300

interface SeriesRow {
  id: number
  name: string
  description: string | null
  sort_order: number
}

interface RevisionRow {
  id: string
  series_id: number
  revision_label: string
  effective_date: string | null
  filename: string
  mime_type: string | null
  diff_json: DiffChunk[] | null
  uploaded_by: string
  created_at: string
}

interface AttachmentRow {
  id: string
  filename: string
  mime_type: string | null
}

function toSeries(row: SeriesRow): DocumentSeries {
  return { id: row.id, name: row.name, description: row.description, sortOrder: row.sort_order }
}

function toAttachment(row: AttachmentRow): DocumentRevisionAttachment {
  return { id: row.id, filename: row.filename, mimeType: row.mime_type }
}

function toRevision(row: RevisionRow, attachments: AttachmentRow[] = []): DocumentRevision {
  return {
    id: row.id,
    seriesId: row.series_id,
    revisionLabel: row.revision_label,
    effectiveDate: row.effective_date,
    filename: row.filename,
    mimeType: row.mime_type,
    diff: row.diff_json,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    attachments: attachments.map(toAttachment),
  }
}

// Supabase Storage 객체 키에 원본 파일명(한글/공백/특수문자)을 그대로 쓰면 "Invalid key" 오류가 나는
// 경우가 있어, storage_path에는 확장자만 남기고 원본 파일명은 filename 컬럼에만 보존한다.
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[a-zA-Z0-9]+$/)
  return match ? match[0] : ""
}

// ── 문서 시리즈 ───────────────────────────────────────────────
export async function listSeries(): Promise<DocumentSeries[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_SERIES)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`문서 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as SeriesRow[]).map(toSeries)
}

export async function listSeriesWithLatestRevision(): Promise<SeriesWithLatestRevision[]> {
  const series = await listSeries()
  if (series.length === 0) return []

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from(TABLE_REVISIONS)
    .select("id, series_id, revision_label, created_at")
    .in(
      "series_id",
      series.map((s) => s.id),
    )
    .order("created_at", { ascending: false })
  if (error) throw new Error(`리비전 목록을 불러오지 못했습니다: ${error.message}`)

  const rows = (data as Pick<RevisionRow, "id" | "series_id" | "revision_label" | "created_at">[]) ?? []
  const latestBySeries = new Map<number, (typeof rows)[number]>()
  const countBySeries = new Map<number, number>()
  for (const row of rows) {
    countBySeries.set(row.series_id, (countBySeries.get(row.series_id) ?? 0) + 1)
    if (!latestBySeries.has(row.series_id)) latestBySeries.set(row.series_id, row)
  }

  return series.map((s) => {
    const latest = latestBySeries.get(s.id)
    return {
      ...s,
      revisionCount: countBySeries.get(s.id) ?? 0,
      latestRevision: latest ? { id: latest.id, revisionLabel: latest.revision_label, createdAt: latest.created_at } : null,
    }
  })
}

export async function getSeriesById(id: number): Promise<DocumentSeries | null> {
  const { data, error } = await getSupabaseServerClient().from(TABLE_SERIES).select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`문서 정보를 불러오지 못했습니다: ${error.message}`)
  return data ? toSeries(data as SeriesRow) : null
}

export async function createSeries(name: string, description: string | null): Promise<DocumentSeries> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE_SERIES)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from(TABLE_SERIES)
    .insert({ name: name.trim(), description: description?.trim() || null, sort_order: nextOrder })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 문서명입니다.")
    throw new Error(`문서를 추가하지 못했습니다: ${error.message}`)
  }
  return toSeries(data as SeriesRow)
}

export async function renameSeries(id: number, name: string, description: string | null): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE_SERIES)
    .update({ name: name.trim(), description: description?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 문서명입니다.")
    throw new Error(`문서 정보를 수정하지 못했습니다: ${error.message}`)
  }
}

export async function reorderSeries(items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase.from(TABLE_SERIES).update({ sort_order: item.sortOrder }).eq("id", item.id)
    if (error) throw new Error(`문서 순서를 저장하지 못했습니다: ${error.message}`)
  }
}

async function removeRevisionFiles(revisionIds: string[]): Promise<void> {
  if (!revisionIds.length) return
  const supabase = getSupabaseServerClient()
  const { data } = await supabase.from(TABLE_REVISIONS).select("storage_path").in("id", revisionIds)
  const paths = ((data as { storage_path: string }[]) ?? []).map((row) => row.storage_path)

  const { data: attachmentRows } = await supabase
    .from(TABLE_ATTACHMENTS)
    .select("storage_path")
    .in("revision_id", revisionIds)
  const attachmentPaths = ((attachmentRows as { storage_path: string }[]) ?? []).map((row) => row.storage_path)

  const allPaths = [...paths, ...attachmentPaths]
  if (allPaths.length) await supabase.storage.from(BUCKET).remove(allPaths)
}

export async function deleteSeries(id: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: revisions } = await supabase.from(TABLE_REVISIONS).select("id").eq("series_id", id)
  const revisionIds = ((revisions as { id: string }[]) ?? []).map((row) => row.id)
  await removeRevisionFiles(revisionIds)

  // document_revisions는 on delete cascade로 함께 삭제된다.
  const { error } = await supabase.from(TABLE_SERIES).delete().eq("id", id)
  if (error) throw new Error(`문서를 삭제하지 못했습니다: ${error.message}`)
}

async function fetchAttachmentsByRevisionId(revisionIds: string[]): Promise<Map<string, AttachmentRow[]>> {
  const attachmentsByRevision = new Map<string, AttachmentRow[]>()
  if (revisionIds.length === 0) return attachmentsByRevision

  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_ATTACHMENTS)
    .select("id, revision_id, filename, mime_type")
    .in("revision_id", revisionIds)
  if (error) throw new Error(`첨부파일 목록을 불러오지 못했습니다: ${error.message}`)

  for (const row of (data as (AttachmentRow & { revision_id: string })[]) ?? []) {
    const list = attachmentsByRevision.get(row.revision_id) ?? []
    list.push(row)
    attachmentsByRevision.set(row.revision_id, list)
  }
  return attachmentsByRevision
}

// ── 리비전 ───────────────────────────────────────────────────
export async function listRevisions(seriesId: number): Promise<DocumentRevision[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_REVISIONS)
    .select("id, series_id, revision_label, effective_date, filename, mime_type, diff_json, uploaded_by, created_at")
    .eq("series_id", seriesId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`리비전 목록을 불러오지 못했습니다: ${error.message}`)

  const rows = (data as RevisionRow[]) ?? []
  const attachmentsByRevision = await fetchAttachmentsByRevisionId(rows.map((row) => row.id))
  return rows.map((row) => toRevision(row, attachmentsByRevision.get(row.id) ?? []))
}

export async function getRevisionById(id: string): Promise<DocumentRevision | null> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_REVISIONS)
    .select("id, series_id, revision_label, effective_date, filename, mime_type, diff_json, uploaded_by, created_at")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`리비전 정보를 불러오지 못했습니다: ${error.message}`)
  if (!data) return null

  const attachmentsByRevision = await fetchAttachmentsByRevisionId([id])
  return toRevision(data as RevisionRow, attachmentsByRevision.get(id) ?? [])
}

interface CreateRevisionInput {
  seriesId: number
  revisionLabel: string
  effectiveDate: string | null
  filename: string
  mimeType: string | null
  content: Buffer
  uploadedBy: string
  attachments: { filename: string; mimeType: string | null; content: Buffer }[]
}

export async function createRevision(input: CreateRevisionInput): Promise<DocumentRevision> {
  const supabase = getSupabaseServerClient()

  // diff 기준이 될 직전 리비전의 추출 텍스트를 가져온다(없으면 최초 리비전).
  const { data: previousRow } = await supabase
    .from(TABLE_REVISIONS)
    .select("extracted_text")
    .eq("series_id", input.seriesId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const extractedText = await extractPdfText(input.content)
  const diff = previousRow ? computeLineDiff(previousRow.extracted_text ?? "", extractedText) : null

  const revisionId = randomUUID()
  const storagePath = `series/${input.seriesId}/${revisionId}${getFileExtension(input.filename)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.content, { contentType: input.mimeType ?? undefined, upsert: false })
  if (uploadError) throw new Error(`파일 저장에 실패했습니다: ${uploadError.message}`)

  // 메인 파일 업로드 후, 추가 첨부(서브 파일)들을 같은 버킷의 별도 경로에 업로드한다.
  const uploadedAttachmentPaths: string[] = []
  const attachmentRows: { id: string; filename: string; storage_path: string; mime_type: string | null }[] = []
  for (const att of input.attachments) {
    const attachmentId = randomUUID()
    const attachmentPath = `revisions/${revisionId}/attachments/${attachmentId}${getFileExtension(att.filename)}`
    const { error: attUploadError } = await supabase.storage
      .from(BUCKET)
      .upload(attachmentPath, att.content, { contentType: att.mimeType ?? undefined, upsert: false })
    if (attUploadError) {
      await supabase.storage.from(BUCKET).remove([storagePath, ...uploadedAttachmentPaths])
      throw new Error(`첨부파일(${att.filename}) 저장에 실패했습니다: ${attUploadError.message}`)
    }
    uploadedAttachmentPaths.push(attachmentPath)
    attachmentRows.push({ id: attachmentId, filename: att.filename, storage_path: attachmentPath, mime_type: att.mimeType })
  }

  const { data: row, error: insertError } = await supabase
    .from(TABLE_REVISIONS)
    .insert({
      id: revisionId,
      series_id: input.seriesId,
      revision_label: input.revisionLabel.trim(),
      effective_date: input.effectiveDate,
      filename: input.filename,
      storage_path: storagePath,
      mime_type: input.mimeType,
      extracted_text: extractedText,
      diff_json: diff,
      uploaded_by: input.uploadedBy,
    })
    .select("id, series_id, revision_label, effective_date, filename, mime_type, diff_json, uploaded_by, created_at")
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath, ...uploadedAttachmentPaths])
    if (insertError.code === "23505") throw new Error("이미 존재하는 리비전 번호입니다.")
    throw new Error(`리비전 저장에 실패했습니다: ${insertError.message}`)
  }

  if (attachmentRows.length) {
    const { error: attInsertError } = await supabase.from(TABLE_ATTACHMENTS).insert(
      attachmentRows.map((r) => ({
        id: r.id,
        revision_id: revisionId,
        filename: r.filename,
        storage_path: r.storage_path,
        mime_type: r.mime_type,
      })),
    )
    if (attInsertError) throw new Error(`첨부파일 정보를 저장하지 못했습니다: ${attInsertError.message}`)
  }

  return toRevision(
    row as RevisionRow,
    attachmentRows.map((r) => ({ id: r.id, filename: r.filename, mime_type: r.mime_type })),
  )
}

export async function deleteRevision(id: string): Promise<void> {
  await removeRevisionFiles([id])
  const { error } = await getSupabaseServerClient().from(TABLE_REVISIONS).delete().eq("id", id)
  if (error) throw new Error(`리비전 삭제에 실패했습니다: ${error.message}`)
}

export async function getRevisionFileUrl(id: string): Promise<{ url: string; filename: string } | null> {
  const supabase = getSupabaseServerClient()
  const { data: row, error } = await supabase
    .from(TABLE_REVISIONS)
    .select("storage_path, filename")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`파일 정보를 불러오지 못했습니다: ${error.message}`)
  if (!row) return null

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)
  if (urlError || !data) throw new Error(`다운로드 링크 생성에 실패했습니다: ${urlError?.message ?? "unknown error"}`)
  return { url: data.signedUrl, filename: row.filename }
}

export async function getRevisionAttachmentDownloadUrl(id: string): Promise<{ url: string; filename: string } | null> {
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
