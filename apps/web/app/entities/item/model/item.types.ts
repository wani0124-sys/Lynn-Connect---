export type ItemStatus = "active" | "pending" | "archived"

export interface Item {
  id: string
  name: string
  status: ItemStatus
  owner: string
  amount: number
  updatedAt: string
}

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  active: "활성",
  pending: "대기",
  archived: "보관",
}
