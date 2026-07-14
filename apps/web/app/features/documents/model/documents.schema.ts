export const MAX_REVISION_FILE_SIZE_BYTES = 30 * 1024 * 1024 // 30MB

export function validateSeriesName(name: string): string | null {
  if (!name.trim()) return "문서명을 입력하세요."
  return null
}

export function validateRevisionLabel(label: string): string | null {
  if (!label.trim()) return "리비전 번호를 입력하세요."
  return null
}

export function validateRevisionFile(file: File): string | null {
  if (file.size === 0) return "파일을 선택해 주세요."
  if (!file.name.toLowerCase().endsWith(".pdf")) return "PDF 파일만 업로드할 수 있습니다."
  if (file.size > MAX_REVISION_FILE_SIZE_BYTES) return "파일 크기는 30MB를 넘을 수 없습니다."
  return null
}
