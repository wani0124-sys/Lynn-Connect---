import type { Site, SiteInspection } from "~/entities/site/model/site.types"
import { getAnthropicClient } from "~/shared/lib/anthropic.server"

const SITE_ANALYSIS_MODEL = "claude-haiku-4-5"
const MAX_ANSWER_TOKENS = 2048

export interface InspectionChatMessage {
  role: "user" | "assistant"
  content: string
}

const SYSTEM_PROMPT = `당신은 건설 현장이 받은 대외기관 점검(관공서·감리단·발주처 등) 기록을 검토하는 안전관리·법무 상담역입니다.
아래 [전체 현장 점검 기록]만 근거로 삼아 사용자의 질문에 답하세요. 사용자는 주로 "무엇을 조치해야 하는지", "법적으로 문제가
될 수 있는 부분이 있는지" 같은 질문을 합니다.

규칙:
- 기록에 없는 사실을 추측하거나 지어내지 마세요. 근거가 부족하면 "기록만으로는 확인할 수 없다"고 답하세요.
- 답변은 한국어로, 필요한 현장명/점검명을 구체적으로 인용하세요.
- 법적 판단이 필요한 질문에는 참고용 의견이며 최종 법적 판단이 아니라는 점을 짧게 덧붙이세요.
- 점검 기록과 무관한 질문에는 이 기록만으로는 답할 수 없다고 안내하세요.`

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
  const message = await client.messages.create({
    model: SITE_ANALYSIS_MODEL,
    max_tokens: MAX_ANSWER_TOKENS,
    system: `${SYSTEM_PROMPT}\n\n[전체 현장 점검 기록]\n${recordsText}`,
    messages: conversation.map((m) => ({ role: m.role, content: m.content })),
  })

  const textBlock = message.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") throw new Error("AI 응답을 받지 못했습니다.")
  return textBlock.text
}
