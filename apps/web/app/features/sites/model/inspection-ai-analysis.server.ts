import Anthropic from "@anthropic-ai/sdk"
import type { Site, SiteInspection } from "~/entities/site/model/site.types"
import { getAnthropicClient } from "~/shared/lib/anthropic.server"

const SITE_ANALYSIS_MODEL = "claude-haiku-4-5"
const MAX_ANSWER_TOKENS = 3072

export interface InspectionChatMessage {
  role: "user" | "assistant"
  content: string
}

const SYSTEM_PROMPT = `당신은 건설 현장이 받은 대외기관 점검(관공서·감리단·발주처 등) 기록을 검토하는 안전관리·법무 상담역입니다.
아래 [전체 현장 점검 기록]을 근거로 사용자의 질문에 답하세요. 사용자는 주로 "무엇을 조치해야 하는지", "법적으로 문제가
될 수 있는 부분이 있는지" 같은 질문을 합니다.

법령 확인이 필요한 질문(예: 관련 법 조항, 위반 시 처벌·과태료 수준)에는 web_search 도구로 국가법령정보센터
(law.go.kr, 법제처)를 검색해 현재 시행 중인 조문을 근거로 답하고, 어떤 법령·조항을 확인했는지 출처를 밝히세요.
검색 결과와 점검 기록 중 어느 쪽에 근거한 내용인지 구분해서 서술하세요.

규칙:
- 점검 기록에 없는 사실을 추측하거나 지어내지 마세요. 근거가 부족하면 "기록만으로는 확인할 수 없다"고 답하세요.
- 답변은 한국어로, 필요한 현장명/점검명을 구체적으로 인용하세요.
- 법적 판단이 필요한 질문에는 참고용 의견이며 최종 법적 판단이 아니라는 점을 짧게 덧붙이세요.
- 이 기능은 현장 점검 기록 검토와 관련 법령 확인 용도입니다. 점검 기록·법령 확인과 무관한 질문(잡담, 다른 주제 등)에는
  답하지 말고 "이 기능은 현장 점검 기록 관련 질문 전용입니다. 그 외 질문은 다른 서비스를 이용해 주세요."라고 안내하세요.`

function formatSiteBlock(site: Site, inspections: SiteInspection[]): string {
  if (inspections.length === 0) return `[현장: ${site.name}]\n(점검 기록 없음)`

  const records = inspections
    .map((insp) => {
      const lines = [
        `- 제목: ${insp.title}`,
        `  점검기관: ${insp.inspectorOrg} / 결과: ${insp.result} / 재점검필요: ${insp.requiresReinspection ? "예" : "아니오"}`,
        `  점검일: ${insp.inspectedAt}${insp.inspectedAtEnd ? ` ~ ${insp.inspectedAtEnd}` : ""}${insp.nextInspectionAt ? ` / 다음 점검 예정일: ${insp.nextInspectionAt}` : ""}`,
      ]
      if (insp.purpose) lines.push(`  점검취지: ${insp.purpose}`)
      if (insp.content) lines.push(`  점검내용: ${insp.content}`)
      if (insp.resultDetail) lines.push(`  결과상세: ${insp.resultDetail}`)
      if (insp.findings) lines.push(`  지적사항: ${insp.findings}`)
      return lines.join("\n")
    })
    .join("\n")

  return `[현장: ${site.name}]\n${records}`
}

// 사용자가 현장 점검 기록에 대해 질문하면 답하는 대화형 Q&A. 매 요청마다 전체 점검 기록을
// system prompt에 넣고, 대화 이력(conversation)은 messages로 전달해 멀티턴을 지원한다.
export async function askAboutInspections(
  sites: Site[],
  inspectionsBySiteId: Map<number, SiteInspection[]>,
  conversation: InspectionChatMessage[],
): Promise<string> {
  const recordsText = sites.map((site) => formatSiteBlock(site, inspectionsBySiteId.get(site.id) ?? [])).join("\n\n")

  const client = getAnthropicClient()

  let message: Anthropic.Message
  try {
    message = await client.messages.create({
      model: SITE_ANALYSIS_MODEL,
      max_tokens: MAX_ANSWER_TOKENS,
      system: `${SYSTEM_PROMPT}\n\n[전체 현장 점검 기록]\n${recordsText}`,
      messages: conversation.map((m) => ({ role: m.role, content: m.content })),
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3, allowed_callers: ["direct"] }],
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
    throw new Error("답변을 받는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
  }

  const answer = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
  if (!answer) throw new Error("AI 응답을 받지 못했습니다.")
  return answer
}
