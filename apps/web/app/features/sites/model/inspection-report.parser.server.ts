import { extractPdfText } from "~/shared/lib/pdf.server"

export interface ParsedInspectionReport {
  title: string | null
  inspectorOrg: string | null
  inspectedAt: string | null
  inspectedAtEnd: string | null
  inspectionTime: string | null
  inspectors: string | null
  purpose: string | null
  findings: string | null
  result: string | null
  content: string | null
  resultDetail: string | null
}

// "[현장명] ... 점검 결과 보고" 같은 표 형식 결과보고 PDF 전용 파서다.
// PDF 텍스트 추출 순서는 원본 문서(주로 한글/워드로 만든 표)의 내부 구조에 따라 달라져서
// 완벽하지 않다 — 라벨을 앵커로 삼아 앞/뒤 텍스트를 잘라내는 휴리스틱이며, 사용자가 결과를
// 반드시 확인·수정한 뒤 저장하는 것을 전제로 한다.

const LABEL = {
  title: /^점\s*검\s*명\s+(.+)$/m,
  inspectorOrg: /^점검\s*기관\s*(?:\/\s*주체)?\s+(.+)$/m,
  inspectedAt: /^점검\s*일시\s+(.+)$/m,
  inspectorsHeader: /^점\s*검\s*자\s*$/,
  contentMarker: /^\[?\s*점검\s*내용\s*\]?\s*$/,
  resultMarker: /^\[?\s*점검\s*결과\s*\]?\s*$/,
  inspectionMatters: /^점검\s*사항\s*$/,
  resultSummary: /^점검\s*결과\s+(.+)$/m,
  purposeLabel: /^점검\s*취지\s*$/,
  findings: /^지적\s*사항\s+(.+)$/m,
}

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function sliceBetween(lines: string[], startExclusive: number, endExclusive: number): string[] {
  if (startExclusive < 0 || endExclusive < 0 || startExclusive >= endExclusive) return []
  return lines.slice(startExclusive + 1, endExclusive)
}

function findIndex(lines: string[], pattern: RegExp): number {
  return lines.findIndex((line) => pattern.test(line))
}

function findBracketMarkerIndex(lines: string[], label: "점검내용" | "점검결과"): number {
  return lines.findIndex((line) => line === `[${label}]` || line === label)
}

// "2026년 7월 9일(목)~7월 10일(금), 각 10:00 ~ 15:00" 같은 문자열에서 시작일/종료일/시간을 뽑는다.
function parseInspectionPeriod(raw: string | null): { start: string | null; end: string | null; time: string | null } {
  if (!raw) return { start: null, end: null, time: null }

  const startMatch = raw.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (!startMatch) return { start: null, end: null, time: null }
  const year = startMatch[1]
  const start = `${year}-${startMatch[2].padStart(2, "0")}-${startMatch[3].padStart(2, "0")}`

  const afterStart = raw.slice((startMatch.index ?? 0) + startMatch[0].length)
  let end: string | null = null
  const endMatch = afterStart.match(/^[^\d]{0,6}(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (endMatch && /^[\s~∼-]/.test(afterStart.replace(/\([^)]*\)/, ""))) {
    const endYear = endMatch[1] ?? year
    end = `${endYear}-${endMatch[2].padStart(2, "0")}-${endMatch[3].padStart(2, "0")}`
  }

  const timeMatch = raw.match(/(\d{1,2}:\d{2}\s*[~∼-]\s*\d{1,2}:\d{2})/)
  const timePrefixMatch = raw.match(/,\s*([^,]*\d{1,2}:\d{2}[^,]*)$/)
  const time = timePrefixMatch?.[1]?.trim() ?? timeMatch?.[1]?.trim() ?? null

  return { start, end, time }
}

export async function parseInspectionReportPdf(buffer: Buffer): Promise<ParsedInspectionReport> {
  const text = await extractPdfText(buffer)
  const lines = toLines(text)

  const title = text.match(LABEL.title)?.[1]?.trim() ?? null
  const inspectorOrg = text.match(LABEL.inspectorOrg)?.[1]?.trim() ?? null
  const inspectedAtRaw = text.match(LABEL.inspectedAt)?.[1]?.trim() ?? null
  const { start, end, time } = parseInspectionPeriod(inspectedAtRaw)

  const inspectorsHeaderIdx = findIndex(lines, LABEL.inspectorsHeader)
  const contentMarkerIdx = findBracketMarkerIndex(lines, "점검내용")
  const resultMarkerIdx = findBracketMarkerIndex(lines, "점검결과")
  const mattersIdx = findIndex(lines, LABEL.inspectionMatters)

  const inspectors =
    inspectorsHeaderIdx !== -1
      ? sliceBetween(lines, inspectorsHeaderIdx, contentMarkerIdx !== -1 ? contentMarkerIdx : lines.length).join("\n") || null
      : null

  const content =
    contentMarkerIdx !== -1
      ? sliceBetween(lines, contentMarkerIdx, resultMarkerIdx !== -1 ? resultMarkerIdx : lines.length).join("\n") || null
      : null

  const resultDetail =
    resultMarkerIdx !== -1
      ? sliceBetween(lines, resultMarkerIdx, mattersIdx !== -1 ? mattersIdx : lines.length).join("\n") || null
      : null

  const result = text.match(LABEL.resultSummary)?.[1]?.trim() ?? null

  const purposeLabelIdx = findIndex(lines, LABEL.purposeLabel)
  const resultSummaryIdx = lines.findIndex((line) => LABEL.resultSummary.test(line))
  const purpose =
    purposeLabelIdx !== -1 && resultSummaryIdx !== -1 && resultSummaryIdx < purposeLabelIdx
      ? sliceBetween(lines, resultSummaryIdx, purposeLabelIdx).join(" ").trim() || null
      : null

  const findingsLabelMatch = text.match(LABEL.findings)
  let findings: string | null = null
  if (findingsLabelMatch) {
    const findingsLineIdx = lines.findIndex((line) => LABEL.findings.test(line))
    const tail = findingsLineIdx !== -1 ? lines.slice(findingsLineIdx + 1) : []
    findings = [findingsLabelMatch[1].trim(), ...tail].join("\n").trim() || null
  }

  return {
    title,
    inspectorOrg,
    inspectedAt: start,
    inspectedAtEnd: end,
    inspectionTime: time,
    inspectors,
    purpose,
    findings,
    result,
    content,
    resultDetail,
  }
}
