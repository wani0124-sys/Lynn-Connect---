import type { StandardDepartment } from "~/entities/task-standard/model/task-standard.types"

export interface DepartmentOption {
  value: string
  label: string
}

// 최상위 부서 다음에 하위 부서를 들여쓰기해서 나열한다 (부서 배정 select, 업로드 폼 등에서 공용으로 사용).
export function buildDepartmentOptions(departments: StandardDepartment[]): DepartmentOption[] {
  const roots = departments.filter((dept) => dept.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder)
  const options: DepartmentOption[] = []

  for (const root of roots) {
    options.push({ value: String(root.id), label: root.name })
    const children = departments
      .filter((dept) => dept.parentId === root.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const child of children) {
      options.push({ value: String(child.id), label: `　ㄴ ${child.name}` })
    }
  }

  return options
}
