export type SiteMailAttachment = {
  id: string
  filename: string
  mimeType: string | null
}

export type SiteMailPost = {
  id: string
  siteId: number
  title: string
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
  attachments: SiteMailAttachment[]
}

export type SiteMailPostListItem = Pick<
  SiteMailPost,
  "id" | "siteId" | "title" | "categoryId" | "senderName" | "sentAt" | "createdAt"
> & {
  categoryName: string | null
  categoryColor: string | null
  attachmentCount: number
}

export type SiteMailPostSort = "sent_desc" | "sent_asc" | "created_desc" | "created_asc"

export type SiteMailPostListResult = {
  rows: SiteMailPostListItem[]
  total: number
  page: number
  limit: number
}
