import { useState } from "react"
import { Trash2 } from "lucide-react"
import { buildDepartmentOptions } from "~/entities/task-standard/lib/build-department-options"
import type { StandardCategory, StandardDepartment } from "~/entities/task-standard/model/task-standard.types"
import { Button } from "~/shared/ui/button"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"
import { Select } from "~/shared/ui/select"

export interface BulkActionBarProps {
  count: number
  departments: StandardDepartment[]
  categories: StandardCategory[]
  pending: boolean
  onApplyDepartment: (departmentId: number | null) => void
  onApplyCategory: (categoryId: number | null) => void
  onDelete: () => void
}

export function BulkActionBar({
  count,
  departments,
  categories,
  pending,
  onApplyDepartment,
  onApplyCategory,
  onDelete,
}: BulkActionBarProps) {
  const [departmentId, setDepartmentId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const departmentOptions = buildDepartmentOptions(departments)
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  if (count === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">{count}건 선택됨</p>

        <div className="flex items-center gap-2">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">부서 선택</option>
            <option value="none">부서 없음</option>
            {departmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !departmentId}
            onClick={() => onApplyDepartment(departmentId === "none" ? null : Number(departmentId))}
          >
            부서 적용
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">구분자 선택</option>
            <option value="none">구분자 없음</option>
            {sortedCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !categoryId}
            onClick={() => onApplyCategory(categoryId === "none" ? null : Number(categoryId))}
          >
            구분자 적용
          </Button>
        </div>

        <Button
          type="button"
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => setConfirmingDelete(true)}
          disabled={pending}
        >
          <Trash2 className="size-4" aria-hidden />
          선택 삭제
        </Button>
      </div>

      {confirmingDelete ? (
        <ConfirmPanel
          title={`선택한 ${count}건을 삭제할까요?`}
          description="첨부파일을 포함해 함께 삭제되며 되돌릴 수 없습니다."
          onConfirm={() => {
            setConfirmingDelete(false)
            onDelete()
          }}
          onCancel={() => setConfirmingDelete(false)}
          pending={pending}
        />
      ) : null}
    </div>
  )
}
