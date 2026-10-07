// 현장 메일함 전용 현장(site_mail_sites). 대외기관 점검의 sites와는 별개 목록이다.
// writerMemberIds: 이 현장 메일을 업로드·수정·삭제할 수 있는 현장 계정(본사 계정은 지정 없이도 항상 가능).
export type SiteMailSite = {
  id: number
  name: string
  sortOrder: number
  writerMemberIds: string[]
}

// 현장 메일함 구분자. 본사 구분자(StandardCategory)와 같은 모양에 상위 구분자(parentId)가 더해져 최대 3단계로 나뉜다.
// parentId가 null이면 1단계 구분자다. sortOrder는 같은 상위 구분자 안에서의 순서다.
export type SiteMailCategory = {
  id: number
  name: string
  color: string
  sortOrder: number
  parentId: number | null
}

export const SITE_MAIL_CATEGORY_MAX_DEPTH = 3

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
  // "공사 › 건축 › 설계"처럼 1단계부터 이어 붙인 이름(1단계 구분자면 categoryName과 같다).
  categoryPath: string | null
  attachmentCount: number
}

export type SiteMailPostSort = "sent_desc" | "sent_asc" | "created_desc" | "created_asc"

export type SiteMailPostListResult = {
  rows: SiteMailPostListItem[]
  total: number
  page: number
  limit: number
}
