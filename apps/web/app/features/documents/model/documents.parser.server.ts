import { diffLines } from "diff"
import type { DiffChunk } from "~/entities/document/model/document.types"

export { extractPdfText } from "~/shared/lib/pdf.server"

// 리비전 간 텍스트를 줄 단위로 비교한다. PDF 표 셀 단위까지는 구분하지 못하며,
// 추출된 텍스트의 줄 순서 기준으로 추가/삭제/동일 구간을 나눈다.
export function computeLineDiff(previousText: string, currentText: string): DiffChunk[] {
  return diffLines(previousText, currentText).map((part) => ({
    type: part.added ? "added" : part.removed ? "removed" : "unchanged",
    value: part.value,
  }))
}
