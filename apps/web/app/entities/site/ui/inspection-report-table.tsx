import type { ReactNode } from "react"
import type { SiteInspection } from "~/entities/site/model/site.types"
import { formatDate } from "~/shared/lib/format"

// 점검 결과보고 인쇄 양식(routes/inspection-print.tsx)과 동일한 표 형태로 점검 상세 내용을 보여준다.
// 인쇄 화면과 현장 점검 목록의 펼치기 보기가 같은 컴포넌트를 공유한다.
export function formatInspectionPeriod(inspection: SiteInspection): string {
  const start = formatDate(inspection.inspectedAt)
  const period =
    inspection.inspectedAtEnd && inspection.inspectedAtEnd !== inspection.inspectedAt
      ? `${start} ~ ${formatDate(inspection.inspectedAtEnd)}`
      : start
  return inspection.inspectionTime ? `${period}, ${inspection.inspectionTime}` : period
}

function ReportRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <th className="w-28 shrink-0 border border-foreground bg-muted p-2 text-center align-top text-sm font-medium print:bg-gray-100">
        {label}
      </th>
      <td className="whitespace-pre-wrap border border-foreground p-2 align-top text-sm">{value}</td>
    </tr>
  )
}

export function InspectionReportTable({ inspection }: { inspection: SiteInspection }) {
  const inspectionContent = [
    inspection.content ? `[점검내용]\n${inspection.content}` : "",
    inspection.resultDetail ? `[점검결과]\n${inspection.resultDetail}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  return (
    <table className="w-full border-collapse">
      <tbody>
        <ReportRow label="점 검 명" value={inspection.title} />
        <ReportRow label="점검기관" value={inspection.inspectorOrg} />
        <ReportRow label="점검일시" value={formatInspectionPeriod(inspection)} />
        {inspection.inspectors ? <ReportRow label="점 검 자" value={inspection.inspectors} /> : null}
        {inspection.purpose ? <ReportRow label="점검취지" value={inspection.purpose} /> : null}
        {inspection.findings ? <ReportRow label="지적사항" value={inspection.findings} /> : null}
        <ReportRow label="점검결과" value={inspection.result} />
        {inspectionContent ? <ReportRow label="점검사항" value={inspectionContent} /> : null}
        {inspection.note ? <ReportRow label="비고" value={inspection.note} /> : null}
      </tbody>
    </table>
  )
}
