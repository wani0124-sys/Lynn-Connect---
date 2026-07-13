import { Badge } from "~/shared/ui/badge"
import { ITEM_STATUS_LABEL, type ItemStatus } from "~/entities/item/model/item.types"

const TONE: Record<ItemStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  pending: "warning",
  archived: "neutral",
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge tone={TONE[status]}>{ITEM_STATUS_LABEL[status]}</Badge>
}
