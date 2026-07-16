export type SiteInspectionResult = "적합" | "부적합" | "시정조치" | "특이사항 없음"

export const SITE_INSPECTION_RESULTS: SiteInspectionResult[] = ["적합", "부적합", "시정조치", "특이사항 없음"]

export type Site = {
  id: number
  name: string
  address: string | null
  sortOrder: number
}

export type SiteInspectionAttachment = {
  id: string
  filename: string
  mimeType: string | null
}

export type SiteInspection = {
  id: string
  siteId: number
  title: string
  inspectorOrg: string
  inspectedAt: string
  // 점검이 여러 날에 걸치면(예: 7/9~7/10) 종료일을 별도로 둔다. 단일일 점검이면 null.
  inspectedAtEnd: string | null
  // 예: "10:00 ~ 15:00". 자유 형식 텍스트로 둔다.
  inspectionTime: string | null
  result: string
  // 점검취지: 왜 이 점검을 하는지에 대한 설명.
  purpose: string | null
  // 점검자: 소속/성명/인원 등을 자유 형식으로 기록.
  inspectors: string | null
  // 점검내용: 점검 항목을 줄바꿈으로 나열.
  content: string | null
  // 점검결과 상세: 점검결과(요약 배지)와 별개로, 항목별 상세 결과를 줄바꿈으로 기록.
  resultDetail: string | null
  // 지적사항/요청사항: 예) "요청사항 1건\n※ ..."
  findings: string | null
  nextInspectionAt: string | null
  requiresReinspection: boolean
  note: string | null
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string
  attachments: SiteInspectionAttachment[]
}

export type SiteWithLatestInspection = Site & {
  latestInspection: Pick<SiteInspection, "id" | "title" | "inspectedAt" | "result"> | null
  inspectionCount: number
}
