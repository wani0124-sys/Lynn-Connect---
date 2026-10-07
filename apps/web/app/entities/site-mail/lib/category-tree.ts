import { SITE_MAIL_CATEGORY_MAX_DEPTH, type SiteMailCategory } from "~/entities/site-mail/model/site-mail.types"

// 현장 메일함 구분자(최대 3단계)를 다루는 순수 함수 모음. 서버(필터·검증)와 화면(탭·선택 목록)이 함께 쓴다.

export const CATEGORY_PATH_SEPARATOR = " › "

function bySortOrder(a: SiteMailCategory, b: SiteMailCategory) {
  return a.sortOrder - b.sortOrder || a.id - b.id
}

// 바로 아래 단계 구분자(parentId=null이면 1단계 목록).
export function getChildCategories(categories: SiteMailCategory[], parentId: number | null): SiteMailCategory[] {
  return categories.filter((cat) => cat.parentId === parentId).sort(bySortOrder)
}

// 1단계부터 자기 자신까지의 구분자 목록. 없는 id면 빈 배열.
export function getCategoryAncestry(categories: SiteMailCategory[], id: number): SiteMailCategory[] {
  const byId = new Map(categories.map((cat) => [cat.id, cat]))
  const path: SiteMailCategory[] = []
  let current = byId.get(id)
  // 잘못된 데이터로 순환이 생겨도 멈추도록 단계 수만큼만 따라간다.
  while (current && path.length <= categories.length) {
    path.unshift(current)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return path
}

export function getCategoryPathLabel(categories: SiteMailCategory[], id: number): string | null {
  const path = getCategoryAncestry(categories, id)
  return path.length ? path.map((cat) => cat.name).join(CATEGORY_PATH_SEPARATOR) : null
}

// 1단계=1, 2단계=2, 3단계=3.
export function getCategoryDepth(categories: SiteMailCategory[], id: number): number {
  return getCategoryAncestry(categories, id).length
}

// 자기 자신과 모든 하위 구분자 id(상위 구분자로 거를 때 하위 메일까지 포함하기 위해).
export function getCategoryWithDescendantIds(categories: SiteMailCategory[], id: number): number[] {
  const result = [id]
  for (let i = 0; i < result.length; i++) {
    for (const cat of categories) if (cat.parentId === result[i]) result.push(cat.id)
  }
  return result
}

// 자기 자신부터 가장 깊은 하위 구분자까지의 단계 수(하위가 없으면 1).
export function getCategorySubtreeHeight(categories: SiteMailCategory[], id: number): number {
  const children = categories.filter((cat) => cat.parentId === id)
  return 1 + Math.max(0, ...children.map((child) => getCategorySubtreeHeight(categories, child.id)))
}

// 구분자를 옮길 수 있는 상위 구분자 후보. 자기 자신·자기 하위로는 못 옮기고,
// 옮긴 뒤 하위 구분자까지 포함해 3단계를 넘으면 후보에서 뺀다.
export function getMovableParentOptions(categories: SiteMailCategory[], id: number): { id: number; label: string }[] {
  const blocked = new Set(getCategoryWithDescendantIds(categories, id))
  const height = getCategorySubtreeHeight(categories, id)
  return flattenCategoryOptions(categories).filter(
    (option) => !blocked.has(option.id) && option.depth + height <= SITE_MAIL_CATEGORY_MAX_DEPTH,
  )
}

// 선택 목록(select)용: 나무 순서(공사, 공사 › 건축, 공사 › 건축 › 설계, 공무 …)로 펼친 목록.
export function flattenCategoryOptions(categories: SiteMailCategory[]): { id: number; label: string; depth: number }[] {
  const options: { id: number; label: string; depth: number }[] = []
  function walk(parentId: number | null, prefix: string, depth: number) {
    for (const cat of getChildCategories(categories, parentId)) {
      const label = prefix + cat.name
      options.push({ id: cat.id, label, depth })
      walk(cat.id, label + CATEGORY_PATH_SEPARATOR, depth + 1)
    }
  }
  walk(null, "", 1)
  return options
}
