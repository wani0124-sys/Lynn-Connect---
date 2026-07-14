import type { Site } from "~/entities/site/model/site.types"

// 관리 현장 권한 표시용 라벨. null이면 전체 현장, 빈 배열/미배정이면 지정 현장 없음.
export function formatManagedSites(managedSiteIds: number[] | null, sites: Site[]): string {
  if (managedSiteIds === null) return "전체 현장"
  if (managedSiteIds.length === 0) return "지정 현장 없음"
  const names = managedSiteIds
    .map((id) => sites.find((site) => site.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  return names.length > 0 ? names.join(", ") : "지정 현장 없음"
}
