// 현장 메일함 전용 현장(site_mail_sites). 대외기관 점검의 sites와는 별개 목록이다.
// writerMemberIds: 이 현장 메일을 업로드·수정·삭제할 수 있는 현장 계정(본사 계정은 지정 없이도 항상 가능).
export type SiteMailSite = {
  id: number
  name: string
  sortOrder: number
  writerMemberIds: string[]
}

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
