import { Badge } from "~/shared/ui/badge"

const RESULT_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  적합: "success",
  부적합: "danger",
  시정조치: "warning",
  "특이사항 없음": "success",
}

export function InspectionResultBadge({ result }: { result: string }) {
  return <Badge tone={RESULT_TONE[result] ?? "neutral"}>{result}</Badge>
}
