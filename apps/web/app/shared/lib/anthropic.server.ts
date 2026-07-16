import Anthropic from "@anthropic-ai/sdk"

let client: Anthropic | null = null

// AI 분석 등 Claude API를 쓰는 기능에서 공용으로 쓰는 서버 전용 클라이언트.
export function getAnthropicClient(): Anthropic {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")
  }

  client = new Anthropic({ apiKey })
  return client
}
