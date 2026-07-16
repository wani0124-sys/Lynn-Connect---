export type DocumentSeries = {
  id: number
  name: string
  description: string | null
  sortOrder: number
}

export type DiffChunk = {
  type: "added" | "removed" | "unchanged"
  value: string
}

// 리비전에 추가로 첨부하는 참고용 서브 파일(메인 PDF와 별개, diff 대상 아님).
export type DocumentRevisionAttachment = {
  id: string
  filename: string
  mimeType: string | null
}

export type DocumentRevision = {
  id: string
  seriesId: number
  revisionLabel: string
  effectiveDate: string | null
  filename: string
  mimeType: string | null
  diff: DiffChunk[] | null
  uploadedBy: string
  createdAt: string
  attachments: DocumentRevisionAttachment[]
}

export type SeriesWithLatestRevision = DocumentSeries & {
  latestRevision: Pick<DocumentRevision, "id" | "revisionLabel" | "createdAt"> | null
  revisionCount: number
}
