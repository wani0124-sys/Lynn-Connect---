import Anthropic from "@anthropic-ai/sdk"
import { SITE_INSPECTION_RESULTS } from "~/entities/site/model/site.types"
import { getAnthropicClient } from "~/shared/lib/anthropic.server"

const REPORT_PARSE_MODEL = "claude-opus-5-5"
const MAX_OUTPUT_TOKENS = 16000

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

// 결과보고 PDF는 표 형식이 문서마다 달라서 텍스트 순서로 자르면 칸이 뒤섞인다. PDF를 그대로
// Claude에 보내 표를 읽게 하고, 점검 기록 폼 항목에 맞춘 JSON으로 받는다. 추출 결과는 사용자가
// 확인·수정한 뒤 저장하는 것을 전제로 한다.

const SYSTEM_PROMPT = `당신은 건설 현장이 받은 대외기관 점검(관공서·감리단·발주처 등)의 결과보고 PDF를 읽고,
점검 기록 입력 폼의 각 항목에 들어갈 내용을 뽑아내는 역할입니다.

항목별 기준:
- title(점검명): "점검명" 칸의 값. 예: "화성시 공동주택 품질점검 1차"
- inspectorOrg(점검기관/주체): 점검을 실시한 기관. 여러 곳이면 " 및 "로 잇는다.
- inspectedAt / inspectedAtEnd: 점검 시작일과 종료일(YYYY-MM-DD). 하루짜리면 inspectedAtEnd는 null.
- inspectionTime: 점검 시간. 예: "14:00 ~ 16:00", 여러 날이면 "각 10:00 ~ 15:00"
- inspectors(점검자): 점검 인원 구성. 원문의 줄 구분을 유지한다.
- purpose(점검취지): 점검을 실시한 목적.
- content(점검내용): 무엇을 점검했는지(점검 항목, 분야별 점검 대상). 보통 "[점검내용]" 아래에 있다.
- resultDetail(점검결과 상세): 점검 결과의 세부 내용·평가. 보통 "[점검결과]" 아래에 있다.
- findings(지적사항/요청사항): 지적·지도·요청·시정 사항. 원문의 "지적사항", "지도사항", "요청사항" 칸 내용.
- result(점검 결과): 전체 판정을 ${SITE_INSPECTION_RESULTS.map((r) => `"${r}"`).join(", ")} 중 하나로 고른다.

규칙:
- 문서에 있는 내용만 옮기고, 요약하거나 고쳐 쓰지 마세요. 해당 내용이 문서에 없으면 null.
- 같은 내용을 두 항목에 중복해서 넣지 마세요. 표의 칸 제목보다 실제 내용의 성격을 기준으로 항목을 고르세요.
- 여러 줄 항목은 원문의 줄 구분과 "■", "-" 같은 머리 기호를 유지하고 줄바꿈(\\n)으로 구분하세요.`

const nullableString = { type: ["string", "null"] }

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: nullableString,
    inspectorOrg: nullableString,
    inspectedAt: { type: ["string", "null"], description: "YYYY-MM-DD" },
    inspectedAtEnd: { type: ["string", "null"], description: "YYYY-MM-DD" },
    inspectionTime: nullableString,
    inspectors: nullableString,
    purpose: nullableString,
    content: nullableString,
    resultDetail: nullableString,
    findings: nullableString,
    result: { type: ["string", "null"], enum: [...SITE_INSPECTION_RESULTS, null] },
  },
  required: [
    "title",
    "inspectorOrg",
    "inspectedAt",
    "inspectedAtEnd",
    "inspectionTime",
    "inspectors",
    "purpose",
    "content",
    "resultDetail",
    "findings",
    "result",
  ],
  additionalProperties: false,
}

function isoDateOrNull(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function parseInspectionReportPdf(buffer: Buffer): Promise<ParsedInspectionReport> {
  const client = getAnthropicClient()

  let message: Anthropic.Beta.BetaMessage
  try {
    message = await client.beta.messages.create({
      model: REPORT_PARSE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
            },
            { type: "text", text: "이 결과보고 PDF에서 점검 기록 항목을 뽑아 주세요." },
          ],
        },
      ],
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error("요청이 많아 잠시 후 다시 시도해 주세요.")
    }
    if (error instanceof Anthropic.InternalServerError) {
      throw new Error("AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.")
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new Error("AI 서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.")
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new Error("AI 기능 설정에 문제가 있습니다. 관리자에게 문의해 주세요.")
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new Error("PDF를 읽지 못했습니다. 파일이 손상되었거나 너무 크지 않은지 확인해 주세요.")
    }
    throw new Error("PDF 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
  }

  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
    throw new Error("PDF에서 항목을 뽑아내지 못했습니다. 직접 입력해 주세요.")
  }

  const json = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")

  let parsed: ParsedInspectionReport
  try {
    parsed = JSON.parse(json) as ParsedInspectionReport
  } catch {
    throw new Error("PDF에서 항목을 뽑아내지 못했습니다. 직접 입력해 주세요.")
  }

  return {
    ...parsed,
    inspectedAt: isoDateOrNull(parsed.inspectedAt),
    inspectedAtEnd: isoDateOrNull(parsed.inspectedAtEnd),
  }
}
