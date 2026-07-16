import { useEffect, useState } from "react"
import { Link, data, useFetcher, useLoaderData, useSearchParams, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { Plus, Search, Settings2 } from "lucide-react"
import { isHeadquarters } from "~/entities/member/model/member"
import { usePageMenuTitle } from "~/entities/sidebar-menu/lib/use-page-menu-title"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import {
  bulkDeletePosts,
  bulkUpdatePostMeta,
  createCategory,
  createDepartment,
  deleteCategory,
  deleteDepartment,
  listCategories,
  listDepartments,
  listPosts,
  renameCategory,
  renameDepartment,
  reorderCategories,
  reorderDepartments,
} from "~/features/task-standards/model/task-standards.repository.server"
import { BulkActionBar } from "~/features/task-standards/ui/bulk-action-bar"
import { CategoryManageModal } from "~/features/task-standards/ui/category-manage-modal"
import { DepartmentManageModal } from "~/features/task-standards/ui/department-manage-modal"
import { UploadModal } from "~/features/task-standards/ui/upload-modal"
import { CategoryBadge } from "~/entities/task-standard/ui/category-badge"
import type { StandardPostSort } from "~/entities/task-standard/model/task-standard.types"
import { formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { Checkbox } from "~/shared/ui/checkbox"
import { EmptyState } from "~/shared/ui/empty-state"
import { Input } from "~/shared/ui/input"
import { PageHeader } from "~/shared/ui/page-header"
import { Select } from "~/shared/ui/select"
import { Tabs } from "~/shared/ui/tabs"
import { TBody, TD, TH, THead, TR, Table } from "~/shared/ui/table"

const PAGE_SIZE = 30

const SORT_OPTIONS: { value: StandardPostSort; label: string }[] = [
  { value: "sent_desc", label: "발송일 최신순" },
  { value: "sent_asc", label: "발송일 오래된순" },
  { value: "created_desc", label: "등록일 최신순" },
  { value: "created_asc", label: "등록일 오래된순" },
]

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const url = new URL(request.url)
  const departmentId = url.searchParams.get("dept") ?? undefined
  const categoryId = url.searchParams.get("cat") ?? undefined
  const search = url.searchParams.get("q") ?? undefined
  const sort = (url.searchParams.get("sort") as StandardPostSort | null) ?? "sent_desc"
  const page = Number(url.searchParams.get("page") ?? "1") || 1

  const [departments, categories, postList] = await Promise.all([
    listDepartments(),
    listCategories(),
    listPosts({ departmentId, categoryId, search, sort, page, limit: PAGE_SIZE }),
  ])

  return { departments, categories, postList, canManage: isHeadquarters(user.role) }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireHeadquarters(request)
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "department.create": {
        await createDepartment(String(form.get("name") ?? ""), form.get("parentId") ? Number(form.get("parentId")) : null)
        return { ok: true }
      }
      case "department.rename": {
        await renameDepartment(
          Number(form.get("id")),
          String(form.get("name") ?? ""),
          form.get("parentId") ? Number(form.get("parentId")) : null,
        )
        return { ok: true }
      }
      case "department.delete": {
        await deleteDepartment(Number(form.get("id")))
        return { ok: true }
      }
      case "department.reorder": {
        await reorderDepartments(JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      case "category.create": {
        await createCategory(String(form.get("name") ?? ""), String(form.get("color") ?? "#6b7280"))
        return { ok: true }
      }
      case "category.rename": {
        await renameCategory(Number(form.get("id")), String(form.get("name") ?? ""), String(form.get("color") ?? "#6b7280"))
        return { ok: true }
      }
      case "category.delete": {
        await deleteCategory(Number(form.get("id")))
        return { ok: true }
      }
      case "category.reorder": {
        await reorderCategories(JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      case "post.bulkUpdate": {
        const ids = JSON.parse(String(form.get("ids") ?? "[]")) as string[]
        const departmentIdRaw = form.get("departmentId")
        const categoryIdRaw = form.get("categoryId")
        const fields: { departmentId?: number | null; categoryId?: number | null } = {}
        if (departmentIdRaw !== null) fields.departmentId = departmentIdRaw ? Number(departmentIdRaw) : null
        if (categoryIdRaw !== null) fields.categoryId = categoryIdRaw ? Number(categoryIdRaw) : null
        await bulkUpdatePostMeta(ids, fields, user.id)
        return { ok: true }
      }
      case "post.bulkDelete": {
        const ids = JSON.parse(String(form.get("ids") ?? "[]")) as string[]
        await bulkDeletePosts(ids)
        return { ok: true }
      }
      default:
        return data({ error: "알 수 없는 요청입니다." }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
    return data({ error: message }, { status: 400 })
  }
}

export default function StandardsRoute() {
  const { departments, categories, postList, canManage } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const deptFetcher = useFetcher<typeof action>()
  const catFetcher = useFetcher<typeof action>()
  const bulkFetcher = useFetcher<typeof action>()

  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [qInput, setQInput] = useState(searchParams.get("q") ?? "")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedIds(new Set())
  }, [postList])

  const selectedDeptParam = searchParams.get("dept") ?? ""
  const selectedCatParam = searchParams.get("cat") ?? ""
  const sort = (searchParams.get("sort") as StandardPostSort | null) ?? "sent_desc"
  const page = Number(searchParams.get("page") ?? "1") || 1
  const totalPages = Math.max(1, Math.ceil(postList.total / postList.limit))

  const rootDepartments = departments.filter((d) => d.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder)
  const selectedDept = departments.find((d) => String(d.id) === selectedDeptParam)
  const subtabParentId = selectedDept ? (selectedDept.parentId ?? selectedDept.id) : null
  const subDepartments = subtabParentId
    ? departments.filter((d) => d.parentId === subtabParentId).sort((a, b) => a.sortOrder - b.sortOrder)
    : []
  const topDeptTabValue = subtabParentId !== null ? String(subtabParentId) : selectedDeptParam

  function updateParams(next: Record<string, string | null>) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === "") params.delete(key)
        else params.set(key, value)
      }
      params.delete("page")
      return params
    })
  }

  const deptTabs = [
    { value: "", label: "전체" },
    { value: "null", label: "없음" },
    ...rootDepartments.map((dept) => ({ value: String(dept.id), label: dept.name })),
  ]

  const catTabs = [
    { value: "", label: "전체" },
    { value: "null", label: "없음" },
    ...[...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cat) => ({
        value: String(cat.id),
        label: (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
            {cat.name}
          </span>
        ),
      })),
  ]

  const actionError = deptFetcher.data && "error" in deptFetcher.data
    ? deptFetcher.data.error
    : catFetcher.data && "error" in catFetcher.data
      ? catFetcher.data.error
      : bulkFetcher.data && "error" in bulkFetcher.data
        ? bulkFetcher.data.error
        : null

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.size === postList.rows.length ? new Set() : new Set(postList.rows.map((row) => row.id))))
  }

  const pageTitle = usePageMenuTitle("/standards", "부서별 업무기준 (메일공지)")

  return (
    <div className="space-y-4">
      <PageHeader
        title={pageTitle}
        description="본사 기준·공지 메일을 부서/구분자별로 정리해 공유합니다"
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setDeptModalOpen(true)}>
                <Settings2 className="size-4" aria-hidden />
                부서 관리
              </Button>
              <Button variant="outline" onClick={() => setCatModalOpen(true)}>
                <Settings2 className="size-4" aria-hidden />
                구분자 관리
              </Button>
              <Button onClick={() => setUploadModalOpen(true)}>
                <Plus className="size-4" aria-hidden />
                EML 업로드
              </Button>
            </>
          ) : null
        }
      />

      {actionError ? (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div>
      ) : null}

      <Tabs variant="folder" items={deptTabs} value={topDeptTabValue} onChange={(value) => updateParams({ dept: value || null })} />

      {subDepartments.length > 0 ? (
        <Tabs
          items={[{ value: String(subtabParentId), label: "전체" }, ...subDepartments.map((d) => ({ value: String(d.id), label: d.name }))]}
          value={selectedDeptParam}
          onChange={(value) => updateParams({ dept: value || null })}
          className="bg-transparent p-0"
        />
      ) : null}

      <Tabs items={catTabs} value={selectedCatParam} onChange={(value) => updateParams({ cat: value || null })} />

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="relative w-full sm:max-w-xs"
            onSubmit={(e) => {
              e.preventDefault()
              updateParams({ q: qInput.trim() || null })
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="제목, 본문 검색"
              className="pl-9"
              aria-label="검색"
            />
          </form>
          <Select value={sort} onChange={(e) => updateParams({ sort: e.target.value })} aria-label="정렬">
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4">
          {postList.rows.length === 0 ? (
            <EmptyState title="게시글이 없습니다" description="조건에 맞는 기준 문서가 없습니다." />
          ) : (
            <Table className="table-fixed">
              <colgroup>
                {canManage ? <col className="w-10" /> : null}
                <col className="w-24" />
                <col />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-24" />
                <col className="w-14" />
              </colgroup>
              <THead>
                <TR>
                  {canManage ? (
                    <TH className="w-10">
                      <Checkbox
                        checked={selectedIds.size === postList.rows.length}
                        onChange={toggleAll}
                        aria-label="전체 선택"
                      />
                    </TH>
                  ) : null}
                  <TH>구분자</TH>
                  <TH>제목</TH>
                  <TH>부서</TH>
                  <TH>발신자</TH>
                  <TH>등록일</TH>
                  <TH className="text-right">첨부</TH>
                </TR>
              </THead>
              <TBody>
                {postList.rows.map((post) => (
                  <TR key={post.id}>
                    {canManage ? (
                      <TD>
                        <Checkbox checked={selectedIds.has(post.id)} onChange={() => toggleOne(post.id)} aria-label="선택" />
                      </TD>
                    ) : null}
                    <TD className="whitespace-nowrap">
                      {post.categoryName ? <CategoryBadge name={post.categoryName} color={post.categoryColor ?? "#6b7280"} /> : null}
                    </TD>
                    <TD className="truncate">
                      <Link to={`/standards/${post.id}`} className="font-medium hover:underline" title={post.title}>
                        {post.title}
                      </Link>
                    </TD>
                    <TD className="truncate text-sm text-muted-foreground" title={post.departmentName ?? undefined}>
                      {post.departmentName ?? "-"}
                    </TD>
                    <TD className="truncate text-sm text-muted-foreground" title={post.senderName ?? undefined}>
                      {post.senderName ?? "-"}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(post.createdAt)}</TD>
                    <TD className="whitespace-nowrap text-right tabular-nums">{post.attachmentCount || ""}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">총 {postList.total}건</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                setSearchParams((prev) => {
                  const params = new URLSearchParams(prev)
                  params.set("page", String(page - 1))
                  return params
                })
              }
            >
              이전
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() =>
                setSearchParams((prev) => {
                  const params = new URLSearchParams(prev)
                  params.set("page", String(page + 1))
                  return params
                })
              }
            >
              다음
            </Button>
          </div>
        </div>
      </Card>

      {canManage ? (
        <BulkActionBar
          count={selectedIds.size}
          departments={departments}
          categories={categories}
          pending={bulkFetcher.state !== "idle"}
          onApplyDepartment={(departmentId) =>
            bulkFetcher.submit(
              { intent: "post.bulkUpdate", ids: JSON.stringify([...selectedIds]), departmentId: departmentId === null ? "" : String(departmentId) },
              { method: "post" },
            )
          }
          onApplyCategory={(categoryId) =>
            bulkFetcher.submit(
              { intent: "post.bulkUpdate", ids: JSON.stringify([...selectedIds]), categoryId: categoryId === null ? "" : String(categoryId) },
              { method: "post" },
            )
          }
          onDelete={() => bulkFetcher.submit({ intent: "post.bulkDelete", ids: JSON.stringify([...selectedIds]) }, { method: "post" })}
        />
      ) : null}

      {canManage ? (
        <DepartmentManageModal
          open={deptModalOpen}
          onClose={() => setDeptModalOpen(false)}
          departments={departments}
          pending={deptFetcher.state !== "idle"}
          onCreate={(name, parentId) =>
            deptFetcher.submit({ intent: "department.create", name, parentId: parentId === null ? "" : String(parentId) }, { method: "post" })
          }
          onRename={(id, name, parentId) =>
            deptFetcher.submit(
              { intent: "department.rename", id: String(id), name, parentId: parentId === null ? "" : String(parentId) },
              { method: "post" },
            )
          }
          onDelete={(id) => deptFetcher.submit({ intent: "department.delete", id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) deptFetcher.submit({ intent: "department.reorder", items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}

      {canManage ? (
        <UploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          departments={departments}
          categories={categories}
        />
      ) : null}

      {canManage ? (
        <CategoryManageModal
          open={catModalOpen}
          onClose={() => setCatModalOpen(false)}
          categories={categories}
          pending={catFetcher.state !== "idle"}
          onCreate={(name, color) => catFetcher.submit({ intent: "category.create", name, color }, { method: "post" })}
          onRename={(id, name, color) =>
            catFetcher.submit({ intent: "category.rename", id: String(id), name, color }, { method: "post" })
          }
          onDelete={(id) => catFetcher.submit({ intent: "category.delete", id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) catFetcher.submit({ intent: "category.reorder", items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}
    </div>
  )
}
