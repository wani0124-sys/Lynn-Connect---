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
}

export type SeriesWithLatestRevision = DocumentSeries & {
  latestRevision: Pick<DocumentRevision, "id" | "revisionLabel" | "createdAt"> | null
  revisionCount: number
}
