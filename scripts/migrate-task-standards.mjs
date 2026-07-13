// 코딩연습(레거시 Express+SQLite 앱)의 standards.db 데이터를 Lynn-Connect의 Supabase
// standard_departments/standard_categories/standard_posts/standard_attachments 테이블 및
// task-standards storage 버킷으로 이관하는 일회성 스크립트.
//
// 실행 전 준비:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수 (apps/web/.env와 동일한 값)
//   - supabase/migrations/20260710090000_task_standards.sql이 대상 프로젝트에 적용되어 있을 것
//   - 루트에서 `pnpm install` (@supabase/supabase-js devDependency 설치)
//   - SQLite 읽기는 Node 22.5+에 내장된 실험적 node:sqlite 모듈을 사용한다(별도 네이티브 빌드 불필요).
//     Node 버전이 오래되었다면 22.5 이상으로 올려야 한다.
//
// 실행 예:
//   node --env-file=apps/web/.env scripts/migrate-task-standards.mjs --dry-run   # 카운트만 확인, 쓰기 없음
//   node --env-file=apps/web/.env scripts/migrate-task-standards.mjs            # 실제 이관
//
// 이관 대상 규모(2026-07-10 기준): 부서 29개, 구분자 3개, 게시글 167건, 첨부파일 482개(약 399MB).
// 첨부파일 업로드가 대부분의 실행 시간을 차지하므로 네트워크 상태가 좋은 환경에서 실행한다.
//
// 재실행 안전성: 부서/구분자는 이름 중복 시 skip, 게시글은 content_hash(있으면) 또는 title+sent_at
// 조합으로 기존 게시글을 찾아 skip한다. 게시글이 skip되면 해당 첨부파일도 이미 이관된 것으로 보고 skip한다.
//
// 주의: standards.db는 WAL 저널 모드다. 원본 파일 옆의 .db-wal/.db-shm이 함께 있어야
// 최신 데이터까지 정확히 읽힌다(둘 중 하나라도 빠진 복사본을 읽으면 최근 데이터가 누락될 수 있다).
// 이 스크립트는 항상 원본 경로(LEGACY_DB_PATH)를 직접 읽으므로 복사본을 만들지 않는다.

import path from "node:path"
import fs from "node:fs"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes("--dry-run")

const LEGACY_REPO_PATH = process.env.LEGACY_REPO_PATH ?? path.resolve(__dirname, "..", "..", "코딩연습")
const LEGACY_DB_PATH = path.join(LEGACY_REPO_PATH, "standards.db")
const LEGACY_UPLOADS_PATH = path.join(LEGACY_REPO_PATH, "standards_uploads")

const BUCKET = "task-standards"

function requireEnv(name) {
  const value = process.env[name]
  if (!value && !DRY_RUN) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`)
  }
  return value
}

function getSupabase() {
  const url = requireEnv("SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function openLegacyDb() {
  if (!fs.existsSync(LEGACY_DB_PATH)) {
    throw new Error(`레거시 DB를 찾을 수 없습니다: ${LEGACY_DB_PATH}`)
  }
  return new DatabaseSync(LEGACY_DB_PATH, { readOnly: true })
}

async function migrateDepartments(db, supabase) {
  const rows = db.prepare("SELECT * FROM departments ORDER BY parent_id IS NOT NULL, ord, id").all()
  const idMap = new Map() // legacy id -> new id
  let created = 0
  let skipped = 0

  for (const row of rows) {
    const newParentId = row.parent_id ? idMap.get(row.parent_id) : null

    const { data: existing } = await supabase.from("standard_departments").select("id").eq("name", row.name).maybeSingle()
    if (existing) {
      idMap.set(row.id, existing.id)
      skipped++
      continue
    }

    const { data, error } = await supabase
      .from("standard_departments")
      .insert({ name: row.name, parent_id: newParentId, sort_order: row.ord })
      .select("id")
      .single()
    if (error) throw new Error(`부서 이관 실패(${row.name}): ${error.message}`)
    idMap.set(row.id, data.id)
    created++
  }

  console.log(`부서: ${created}개 생성, ${skipped}개 skip (총 ${rows.length}개)`)
  return idMap
}

async function migrateCategories(db, supabase) {
  const rows = db.prepare("SELECT * FROM categories ORDER BY ord, id").all()
  const idMap = new Map()
  let created = 0
  let skipped = 0

  for (const row of rows) {
    const { data: existing } = await supabase.from("standard_categories").select("id").eq("name", row.name).maybeSingle()
    if (existing) {
      idMap.set(row.id, existing.id)
      skipped++
      continue
    }

    const { data, error } = await supabase
      .from("standard_categories")
      .insert({ name: row.name, color: row.color, sort_order: row.ord })
      .select("id")
      .single()
    if (error) throw new Error(`구분자 이관 실패(${row.name}): ${error.message}`)
    idMap.set(row.id, data.id)
    created++
  }

  console.log(`구분자: ${created}개 생성, ${skipped}개 skip (총 ${rows.length}개)`)
  return idMap
}

async function findExistingPost(supabase, row) {
  if (row.content_hash) {
    const { data } = await supabase.from("standard_posts").select("id").eq("content_hash", row.content_hash).maybeSingle()
    if (data) return data.id
  }
  const query = supabase.from("standard_posts").select("id").eq("title", row.title)
  const { data } = row.sent_at ? await query.eq("sent_at", row.sent_at).maybeSingle() : await query.is("sent_at", null).maybeSingle()
  return data?.id ?? null
}

async function migratePosts(db, supabase, deptIdMap, catIdMap) {
  const rows = db.prepare("SELECT * FROM standards ORDER BY id").all()
  const postIdMap = new Map() // legacy standard id -> { newId, wasCreated }
  let created = 0
  let skipped = 0

  for (const row of rows) {
    const existingId = await findExistingPost(supabase, row)
    if (existingId) {
      postIdMap.set(row.id, { newId: existingId, wasCreated: false })
      skipped++
      continue
    }

    const { data, error } = await supabase
      .from("standard_posts")
      .insert({
        title: row.title,
        department_id: row.dept_id ? (deptIdMap.get(row.dept_id) ?? null) : null,
        category_id: row.category_id ? (catIdMap.get(row.category_id) ?? null) : null,
        sender_email: null,
        sender_name: row.sender || null,
        sent_at: row.sent_at,
        body_html: row.body_html,
        body_text: row.body_text,
        content_hash: row.content_hash,
        created_by: "migration-script",
        created_at: row.created_at,
      })
      .select("id")
      .single()
    if (error) throw new Error(`게시글 이관 실패(${row.title}): ${error.message}`)
    postIdMap.set(row.id, { newId: data.id, wasCreated: true })
    created++
  }

  console.log(`게시글: ${created}건 생성, ${skipped}건 skip (총 ${rows.length}건)`)
  return postIdMap
}

async function migrateAttachments(db, supabase, postIdMap) {
  const rows = db.prepare("SELECT * FROM attachments ORDER BY id").all()
  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const mapped = postIdMap.get(row.standard_id)
    if (!mapped) {
      console.warn(`  경고: 첨부파일 ${row.filename}의 게시글(id=${row.standard_id})을 찾을 수 없어 skip`)
      failed++
      continue
    }
    if (!mapped.wasCreated) {
      // 게시글이 이미 존재했다면(재실행) 첨부파일도 이전 실행에서 이관되었다고 간주한다.
      skipped++
      continue
    }

    const filePath = path.join(LEGACY_UPLOADS_PATH, row.saved_name)
    if (!fs.existsSync(filePath)) {
      console.warn(`  경고: 첨부 파일을 찾을 수 없음: ${filePath}`)
      failed++
      continue
    }

    const content = fs.readFileSync(filePath)
    const attachmentId = randomUUID()
    const ext = path.extname(row.filename || "")
    const storagePath = `posts/${mapped.newId}/${attachmentId}${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, content, { contentType: row.mime_type || undefined, upsert: false })
    if (uploadError) {
      console.warn(`  경고: 업로드 실패(${row.filename}): ${uploadError.message}`)
      failed++
      continue
    }

    const { error: insertError } = await supabase.from("standard_attachments").insert({
      id: attachmentId,
      post_id: mapped.newId,
      filename: row.filename,
      storage_path: storagePath,
      mime_type: row.mime_type,
    })
    if (insertError) {
      console.warn(`  경고: 첨부 메타 저장 실패(${row.filename}): ${insertError.message}`)
      await supabase.storage.from(BUCKET).remove([storagePath])
      failed++
      continue
    }

    uploaded++
    if (uploaded % 25 === 0) console.log(`  첨부파일 진행: ${uploaded}/${rows.length}`)
  }

  console.log(`첨부파일: ${uploaded}개 업로드, ${skipped}개 skip, ${failed}개 실패 (총 ${rows.length}개)`)
}

async function main() {
  const db = openLegacyDb()

  const counts = {
    departments: db.prepare("SELECT COUNT(*) c FROM departments").get().c,
    categories: db.prepare("SELECT COUNT(*) c FROM categories").get().c,
    standards: db.prepare("SELECT COUNT(*) c FROM standards").get().c,
    attachments: db.prepare("SELECT COUNT(*) c FROM attachments").get().c,
  }
  console.log("레거시 DB 카운트:", counts)

  if (DRY_RUN) {
    console.log("--dry-run 모드: 실제 쓰기는 수행하지 않았습니다.")
    db.close()
    return
  }

  const supabase = getSupabase()
  const deptIdMap = await migrateDepartments(db, supabase)
  const catIdMap = await migrateCategories(db, supabase)
  const postIdMap = await migratePosts(db, supabase, deptIdMap, catIdMap)
  await migrateAttachments(db, supabase, postIdMap)

  db.close()
  console.log("이관 완료.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
