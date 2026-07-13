export const MAX_EML_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
export const MAX_EML_FILES_PER_UPLOAD = 30
export const MAX_ATTACHMENT_SIZE_BYTES = 30 * 1024 * 1024 // 30MB

// .eml의 브라우저 MIME 타입은 신뢰할 수 없다(mail-archive.schema.ts와 동일한 이유).
// 확장자 + 크기를 1차 방어선으로 삼고, 실제 형식 검증은 parser의 mailparser 파싱 성공 여부로 한다.
const ALLOWED_EML_MIME_TYPES = ["message/rfc822", "application/octet-stream", ""]

export function validateEmlFile(file: File): string | null {
  if (file.size === 0) return "파일을 선택해 주세요."
  if (!file.name.toLowerCase().endsWith(".eml")) return ".eml 파일만 업로드할 수 있습니다."
  if (!ALLOWED_EML_MIME_TYPES.includes(file.type)) return "지원하지 않는 파일 형식입니다."
  if (file.size > MAX_EML_SIZE_BYTES) return "파일 크기는 20MB를 넘을 수 없습니다."
  return null
}

export function validateEmlFiles(files: File[]): string | null {
  if (files.length === 0) return "파일을 선택해 주세요."
  if (files.length > MAX_EML_FILES_PER_UPLOAD) return `한 번에 최대 ${MAX_EML_FILES_PER_UPLOAD}개까지 업로드할 수 있습니다.`
  for (const file of files) {
    const error = validateEmlFile(file)
    if (error) return `${file.name}: ${error}`
  }
  return null
}

export function validateAttachmentFile(file: File): string | null {
  if (file.size === 0) return "파일을 선택해 주세요."
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) return "파일 크기는 30MB를 넘을 수 없습니다."
  return null
}

export function validateDepartmentName(name: string): string | null {
  if (!name.trim()) return "부서명을 입력하세요."
  return null
}

export function validateCategoryName(name: string): string | null {
  if (!name.trim()) return "구분자명을 입력하세요."
  return null
}

export function validateTitle(title: string): string | null {
  if (!title.trim()) return "제목을 입력하세요."
  if (title.length > 500) return "제목은 500자를 넘을 수 없습니다."
  return null
}
