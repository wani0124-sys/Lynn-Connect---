import type { Item } from "./item.types"

export const mockItems: Item[] = [
  { id: "ITM-1001", name: "샘플 항목 A", status: "active", owner: "김우미", amount: 1250000, updatedAt: "2026-06-30T09:12:00+09:00" },
  { id: "ITM-1002", name: "샘플 항목 B", status: "pending", owner: "이도현", amount: 480000, updatedAt: "2026-06-29T15:40:00+09:00" },
  { id: "ITM-1003", name: "샘플 항목 C", status: "active", owner: "박서준", amount: 2310000, updatedAt: "2026-06-28T11:05:00+09:00" },
  { id: "ITM-1004", name: "샘플 항목 D", status: "archived", owner: "최유나", amount: 90000, updatedAt: "2026-06-25T18:22:00+09:00" },
  { id: "ITM-1005", name: "샘플 항목 E", status: "active", owner: "정민재", amount: 675000, updatedAt: "2026-06-24T08:47:00+09:00" },
  { id: "ITM-1006", name: "샘플 항목 F", status: "pending", owner: "김우미", amount: 1520000, updatedAt: "2026-06-22T13:30:00+09:00" },
  { id: "ITM-1007", name: "샘플 항목 G", status: "active", owner: "이도현", amount: 340000, updatedAt: "2026-06-20T10:10:00+09:00" },
  { id: "ITM-1008", name: "샘플 항목 H", status: "archived", owner: "박서준", amount: 8800000, updatedAt: "2026-06-18T16:55:00+09:00" },
]

export function getMockItem(id: string): Item | undefined {
  return mockItems.find((item) => item.id === id)
}
