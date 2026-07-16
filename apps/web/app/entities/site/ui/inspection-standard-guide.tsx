import { ArrowRight, Bell, CalendarClock, Radio } from "lucide-react"
import { Card, CardContent } from "~/shared/ui/card"

const STAGES = [
  {
    icon: Bell,
    timing: "점검 알림",
    title: "사전대비 계획공지",
    description: "점검 확정 시, 사전대비 계획 공지 및 신속한 현장 지원",
    note: "점검계획 사전대비 계획 공지",
    example: { src: "/inspection-guide/notice.png", caption: "예시: 관공서 점검 사전대비 계획 공지" },
  },
  {
    icon: CalendarClock,
    timing: "점검 7~14일 전",
    title: "본사 사전점검",
    description: "각 부서별 담당업무 현장 RISK 확인 및 점검 전 사전조치",
    note: "기술부서 사전점검 · 경영부서 사전검토",
    example: { src: "/inspection-guide/pre-inspection-report.png", caption: "예시: 대외 주요기관 사전점검 결과보고" },
  },
  {
    icon: Radio,
    timing: "점검 당일",
    title: "실시간 점검 대응",
    description: "점검결과 제출 전 담당 본사임원 실시간 검토 및 추적관리",
    note: "점검내용 SNS 실시간 공유 · 대외이슈 모니터링",
    example: { src: "/inspection-guide/realtime-chat.png", caption: "예시: 점검 당일 실시간 공유 대화" },
  },
] as const

// 대외 주요기관 점검 발생 시 본사 대응 프로세스 기준 안내(고정 콘텐츠). 실제 점검 사례별 기록은
// 사이트 탭(부산장안, 강릉송정 등)에서 관리한다.
export function InspectionStandardGuide() {
  return (
    <Card>
      <div className="rounded-t-lg bg-muted px-5 py-3 text-center">
        <h2 className="text-base font-bold">대외 주요기관 점검 발생 시 대응 기준</h2>
      </div>
      <CardContent className="grid gap-8 pt-6 md:grid-cols-3">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon
          return (
            <div key={stage.timing} className="relative flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <p className="font-semibold text-primary">{stage.timing}</p>
              </div>
              <p className="text-lg font-bold">'{stage.title}'</p>
              <p className="text-sm text-muted-foreground">{stage.description}</p>
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{stage.note}</span>
              </div>

              <div className="relative mt-1 overflow-hidden rounded-lg shadow-sm">
                <img
                  src={stage.example.src}
                  alt={stage.example.caption}
                  className="aspect-[4/5] w-full object-cover object-top"
                />
                <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs text-white">
                  {stage.example.caption}
                </p>
              </div>

              {index < STAGES.length - 1 ? (
                <ArrowRight className="absolute top-3 -right-6 hidden size-5 text-muted-foreground md:block" aria-hidden />
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
