export const MAX_INSPECTION_ATTACHMENT_SIZE_BYTES = 30 * 1024 * 1024 // 30MB

export function validateSiteName(name: string): string | null {
  if (!name.trim()) return "현장명을 입력하세요."
  return null
}

export function validateInspectionTitle(title: string): string | null {
  if (!title.trim()) return "점검명을 입력하세요."
  return null
}

export function validateInspectorOrg(inspectorOrg: string): string | null {
  if (!inspectorOrg.trim()) return "점검기관/주체를 입력하세요."
  return null
}

export function validateInspectionResult(result: string): string | null {
  if (!result.trim()) return "점검 결과를 선택하세요."
  return null
}

export function validateInspectedAt(inspectedAt: string): string | null {
  if (!inspectedAt.trim()) return "점검일을 입력하세요."
  return null
}

export function validateInspectionAttachmentFile(file: File): string | null {
  if (file.size === 0) return "파일을 선택해 주세요."
  if (file.size > MAX_INSPECTION_ATTACHMENT_SIZE_BYTES) return "파일 크기는 30MB를 넘을 수 없습니다."
  return null
}
