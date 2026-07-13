export type SiteInspectionResult = "적합" | "부적합" | "시정조치"

export const SITE_INSPECTION_RESULTS: SiteInspectionResult[] = ["적합", "부적합", "시정조치"]

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
  result: string
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
