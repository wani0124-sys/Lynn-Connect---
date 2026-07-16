import { randomUUID } from "node:crypto"
import { getSupabaseServerClient } from "~/shared/lib/supabase.server"
import type {
  Site,
  SiteInspection,
  SiteInspectionAttachment,
  SiteWithLatestInspection,
} from "~/entities/site/model/site.types"

const TABLE_SITES = "sites"
const TABLE_INSPECTIONS = "site_inspections"
const TABLE_ATTACHMENTS = "site_inspection_attachments"
const BUCKET = "site-inspections"
const SIGNED_URL_TTL_SECONDS = 300

interface SiteRow {
  id: number
  name: string
  address: string | null
  sort_order: number
}

interface InspectionRow {
  id: string
  site_id: number
  title: string
  inspector_org: string
  inspected_at: string
  inspected_at_end: string | null
  inspection_time: string | null
  result: string
  purpose: string | null
  inspectors: string | null
  content: string | null
  result_detail: string | null
  findings: string | null
  next_inspection_at: string | null
  requires_reinspection: boolean
  note: string | null
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

function toSite(row: SiteRow): Site {
  return { id: row.id, name: row.name, address: row.address, sortOrder: row.sort_order }
}

function toAttachment(row: AttachmentRow): SiteInspectionAttachment {
  return { id: row.id, filename: row.filename, mimeType: row.mime_type }
}

function toInspection(row: InspectionRow, attachments: AttachmentRow[]): SiteInspection {
  return {
    id: row.id,
    siteId: row.site_id,
    title: row.title,
    inspectorOrg: row.inspector_org,
    inspectedAt: row.inspected_at,
    inspectedAtEnd: row.inspected_at_end,
    inspectionTime: row.inspection_time,
    result: row.result,
    purpose: row.purpose,
    inspectors: row.inspectors,
    content: row.content,
    resultDetail: row.result_detail,
    findings: row.findings,
    nextInspectionAt: row.next_inspection_at,
    requiresReinspection: row.requires_reinspection,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    attachments: attachments.map(toAttachment),
  }
}

// Supabase Storage 객체 키에 원본 파일명(한글/공백/특수문자)을 그대로 쓰면 "Invalid key" 오류가 나는
// 경우가 있어, storage_path에는 확장자만 남기고 원본 파일명은 filename 컬럼에만 보존한다.
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[a-zA-Z0-9]+$/)
  return match ? match[0] : ""
}

// ── 현장 ─────────────────────────────────────────────────────
export async function listSites(): Promise<Site[]> {
  const { data, error } = await getSupabaseServerClient()
    .from(TABLE_SITES)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw new Error(`현장 목록을 불러오지 못했습니다: ${error.message}`)
  return (data as SiteRow[]).map(toSite)
}

export async function listSitesWithLatestInspection(): Promise<SiteWithLatestInspection[]> {
  const sites = await listSites()
  if (sites.length === 0) return []

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from(TABLE_INSPECTIONS)
    .select("id, site_id, title, inspected_at, result")
    .in(
      "site_id",
      sites.map((s) => s.id),
    )
    .order("inspected_at", { ascending: false })
  if (error) throw new Error(`점검 이력을 불러오지 못했습니다: ${error.message}`)

  const rows = (data as Pick<InspectionRow, "id" | "site_id" | "title" | "inspected_at" | "result">[]) ?? []
  const latestBySite = new Map<number, (typeof rows)[number]>()
  const countBySite = new Map<number, number>()
  for (const row of rows) {
    countBySite.set(row.site_id, (countBySite.get(row.site_id) ?? 0) + 1)
    if (!latestBySite.has(row.site_id)) latestBySite.set(row.site_id, row)
  }

  return sites.map((site) => {
    const latest = latestBySite.get(site.id)
    return {
      ...site,
      inspectionCount: countBySite.get(site.id) ?? 0,
      latestInspection: latest
        ? { id: latest.id, title: latest.title, inspectedAt: latest.inspected_at, result: latest.result }
        : null,
    }
  })
}

export async function getSiteById(id: number): Promise<Site | null> {
  const { data, error } = await getSupabaseServerClient().from(TABLE_SITES).select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`현장 정보를 불러오지 못했습니다: ${error.message}`)
  return data ? toSite(data as SiteRow) : null
}

export async function createSite(name: string, address: string | null): Promise<Site> {
  const supabase = getSupabaseServerClient()
  const { data: maxRow } = await supabase
    .from(TABLE_SITES)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from(TABLE_SITES)
    .insert({ name: name.trim(), address: address?.trim() || null, sort_order: nextOrder })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 현장명입니다.")
    throw new Error(`현장을 추가하지 못했습니다: ${error.message}`)
  }
  return toSite(data as SiteRow)
}

export async function renameSite(id: number, name: string, address: string | null): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from(TABLE_SITES)
    .update({ name: name.trim(), address: address?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") throw new Error("이미 존재하는 현장명입니다.")
    throw new Error(`현장 정보를 수정하지 못했습니다: ${error.message}`)
  }
}

export async function reorderSites(items: { id: number; sortOrder: number }[]): Promise<void> {
  const supabase = getSupabaseServerClient()
  for (const item of items) {
    const { error } = await supabase.from(TABLE_SITES).update({ sort_order: item.sortOrder }).eq("id", item.id)
    if (error) throw new Error(`현장 순서를 저장하지 못했습니다: ${error.message}`)
  }
}

async function removeInspectionAttachmentFiles(inspectionIds: string[]): Promise<void> {
  if (!inspectionIds.length) return
  const supabase = getSupabaseServerClient()
  const { data } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").in("inspection_id", inspectionIds)
  const paths = ((data as { storage_path: string }[]) ?? []).map((row) => row.storage_path)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

export async function deleteSite(id: number): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: inspections } = await supabase.from(TABLE_INSPECTIONS).select("id").eq("site_id", id)
  const inspectionIds = ((inspections as { id: string }[]) ?? []).map((row) => row.id)
  await removeInspectionAttachmentFiles(inspectionIds)

  // site_inspections/site_inspection_attachments는 on delete cascade로 함께 삭제된다.
  const { error } = await supabase.from(TABLE_SITES).delete().eq("id", id)
  if (error) throw new Error(`현장을 삭제하지 못했습니다: ${error.message}`)
}

// ── 점검 이력 ────────────────────────────────────────────────
export async function listInspections(siteId: number): Promise<SiteInspection[]> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from(TABLE_INSPECTIONS)
    .select("*")
    .eq("site_id", siteId)
    .order("inspected_at", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw new Error(`점검 이력을 불러오지 못했습니다: ${error.message}`)

  const rows = (data as InspectionRow[]) ?? []
  if (rows.length === 0) return []

  const { data: attachmentRows, error: attError } = await supabase
    .from(TABLE_ATTACHMENTS)
    .select("id, inspection_id, filename, mime_type")
    .in(
      "inspection_id",
      rows.map((r) => r.id),
    )
  if (attError) throw new Error(`첨부파일 목록을 불러오지 못했습니다: ${attError.message}`)

  const attachmentsByInspection = new Map<string, AttachmentRow[]>()
  for (const row of (attachmentRows as (AttachmentRow & { inspection_id: string })[]) ?? []) {
    const list = attachmentsByInspection.get(row.inspection_id) ?? []
    list.push(row)
    attachmentsByInspection.set(row.inspection_id, list)
  }

  return rows.map((row) => toInspection(row, attachmentsByInspection.get(row.id) ?? []))
}

export async function getInspectionById(id: string): Promise<SiteInspection | null> {
  const supabase = getSupabaseServerClient()
  const { data: row, error } = await supabase.from(TABLE_INSPECTIONS).select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(`점검 기록을 불러오지 못했습니다: ${error.message}`)
  if (!row) return null

  const { data: attachmentRows, error: attError } = await supabase
    .from(TABLE_ATTACHMENTS)
    .select("id, filename, mime_type")
    .eq("inspection_id", id)
  if (attError) throw new Error(`첨부파일 목록을 불러오지 못했습니다: ${attError.message}`)

  return toInspection(row as InspectionRow, (attachmentRows as AttachmentRow[]) ?? [])
}

interface CreateInspectionInput {
  siteId: number
  title: string
  inspectorOrg: string
  inspectedAt: string
  inspectedAtEnd: string | null
  inspectionTime: string | null
  result: string
  purpose: string | null
  inspectors: string | null
  content: string | null
  resultDetail: string | null
  findings: string | null
  nextInspectionAt: string | null
  requiresReinspection: boolean
  note: string | null
  createdBy: string
  attachments: { filename: string; mimeType: string | null; content: Buffer }[]
}

export async function createInspection(input: CreateInspectionInput): Promise<SiteInspection> {
  const supabase = getSupabaseServerClient()
  const inspectionId = randomUUID()
  const uploadedPaths: string[] = []
  const attachmentRows: { id: string; filename: string; storage_path: string; mime_type: string | null }[] = []

  for (const att of input.attachments) {
    const attachmentId = randomUUID()
    const storagePath = `inspections/${inspectionId}/${attachmentId}${getFileExtension(att.filename)}`
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

  const { data: row, error: insertError } = await supabase
    .from(TABLE_INSPECTIONS)
    .insert({
      id: inspectionId,
      site_id: input.siteId,
      title: input.title,
      inspector_org: input.inspectorOrg,
      inspected_at: input.inspectedAt,
      inspected_at_end: input.inspectedAtEnd,
      inspection_time: input.inspectionTime,
      result: input.result,
      purpose: input.purpose,
      inspectors: input.inspectors,
      content: input.content,
      result_detail: input.resultDetail,
      findings: input.findings,
      next_inspection_at: input.nextInspectionAt,
      requires_reinspection: input.requiresReinspection,
      note: input.note,
      created_by: input.createdBy,
    })
    .select("*")
    .single()

  if (insertError) {
    if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths)
    throw new Error(`점검 기록 저장에 실패했습니다: ${insertError.message}`)
  }

  if (attachmentRows.length) {
    const { error: attInsertError } = await supabase.from(TABLE_ATTACHMENTS).insert(
      attachmentRows.map((r) => ({
        id: r.id,
        inspection_id: inspectionId,
        filename: r.filename,
        storage_path: r.storage_path,
        mime_type: r.mime_type,
      })),
    )
    if (attInsertError) throw new Error(`첨부파일 정보를 저장하지 못했습니다: ${attInsertError.message}`)
  }

  return toInspection(row as InspectionRow, attachmentRows.map((r) => ({ id: r.id, filename: r.filename, mime_type: r.mime_type })))
}

interface UpdateInspectionInput {
  title: string
  inspectorOrg: string
  inspectedAt: string
  inspectedAtEnd: string | null
  inspectionTime: string | null
  result: string
  purpose: string | null
  inspectors: string | null
  content: string | null
  resultDetail: string | null
  findings: string | null
  nextInspectionAt: string | null
  requiresReinspection: boolean
  note: string | null
  updatedBy: string
  newAttachments: { filename: string; mimeType: string | null; content: Buffer }[]
}

export async function updateInspection(id: string, input: UpdateInspectionInput): Promise<SiteInspection> {
  const { error: updateError } = await getSupabaseServerClient()
    .from(TABLE_INSPECTIONS)
    .update({
      title: input.title,
      inspector_org: input.inspectorOrg,
      inspected_at: input.inspectedAt,
      inspected_at_end: input.inspectedAtEnd,
      inspection_time: input.inspectionTime,
      result: input.result,
      purpose: input.purpose,
      inspectors: input.inspectors,
      content: input.content,
      result_detail: input.resultDetail,
      findings: input.findings,
      next_inspection_at: input.nextInspectionAt,
      requires_reinspection: input.requiresReinspection,
      note: input.note,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (updateError) throw new Error(`점검 기록을 수정하지 못했습니다: ${updateError.message}`)

  for (const attachment of input.newAttachments) {
    await addInspectionAttachment(id, attachment)
  }

  const updated = await getInspectionById(id)
  if (!updated) throw new Error("수정된 점검 기록을 불러오지 못했습니다.")
  return updated
}

export async function deleteInspection(id: string): Promise<void> {
  await removeInspectionAttachmentFiles([id])
  const { error } = await getSupabaseServerClient().from(TABLE_INSPECTIONS).delete().eq("id", id)
  if (error) throw new Error(`점검 기록 삭제에 실패했습니다: ${error.message}`)
}

// ── 첨부파일 ─────────────────────────────────────────────────
export async function addInspectionAttachment(
  inspectionId: string,
  file: { filename: string; mimeType: string | null; content: Buffer },
): Promise<SiteInspectionAttachment> {
  const supabase = getSupabaseServerClient()
  const attachmentId = randomUUID()
  const storagePath = `inspections/${inspectionId}/${attachmentId}${getFileExtension(file.filename)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.content, { contentType: file.mimeType ?? undefined, upsert: false })
  if (uploadError) throw new Error(`첨부파일 저장에 실패했습니다: ${uploadError.message}`)

  const { error } = await supabase
    .from(TABLE_ATTACHMENTS)
    .insert({ id: attachmentId, inspection_id: inspectionId, filename: file.filename, storage_path: storagePath, mime_type: file.mimeType })

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(`첨부파일 정보를 저장하지 못했습니다: ${error.message}`)
  }
  return { id: attachmentId, filename: file.filename, mimeType: file.mimeType }
}

export async function deleteInspectionAttachment(id: string): Promise<void> {
  const supabase = getSupabaseServerClient()
  const { data: row } = await supabase.from(TABLE_ATTACHMENTS).select("storage_path").eq("id", id).maybeSingle()

  const { error } = await supabase.from(TABLE_ATTACHMENTS).delete().eq("id", id)
  if (error) throw new Error(`첨부파일 삭제에 실패했습니다: ${error.message}`)

  if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path])
}

export async function getInspectionAttachmentDownloadUrl(id: string): Promise<{ url: string; filename: string } | null> {
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
