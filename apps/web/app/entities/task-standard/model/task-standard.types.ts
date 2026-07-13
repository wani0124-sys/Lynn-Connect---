export type StandardDepartment = {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

export type StandardCategory = {
  id: number
  name: string
  color: string
  sortOrder: number
}

export type StandardAttachment = {
  id: string
  filename: string
  mimeType: string | null
}

export type StandardPost = {
  id: string
  title: string
  departmentId: number | null
  categoryId: number | null
  senderEmail: string | null
  senderName: string | null
  sentAt: string | null
  bodyHtml: string | null
  bodyText: string | null
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string
  attachments: StandardAttachment[]
}

export type StandardPostListItem = Pick<StandardPost, "id" | "title" | "departmentId" | "categoryId" | "senderName" | "sentAt" | "createdAt"> & {
  departmentName: string | null
  categoryName: string | null
  categoryColor: string | null
  attachmentCount: number
}

export type StandardPostSort = "sent_desc" | "sent_asc" | "created_desc" | "created_asc"

export type StandardPostListResult = {
  rows: StandardPostListItem[]
  total: number
  page: number
  limit: number
}
