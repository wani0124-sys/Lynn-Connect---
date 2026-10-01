import { useEffect, useState } from "react"
import { Link, data, useFetcher, useLoaderData, useSearchParams, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { Plus, Search, Settings2 } from "lucide-react"
import { canWriteSite, isHeadquarters } from "~/entities/member/model/member"
import { usePageMenuTitle } from "~/entities/sidebar-menu/lib/use-page-menu-title"
import { CategoryBadge } from "~/entities/task-standard/ui/category-badge"
import type { SiteMailPostSort } from "~/entities/site-mail/model/site-mail.types"
import { requireHeadquarters, requireSiteWriteAccess, requireUser } from "~/features/auth/model/session.server"
import {
  bulkDeleteSiteMailPosts,
  bulkUpdateSiteMailPostMeta,
  listSiteMailPosts,
} from "~/features/site-mails/model/site-mails.repository.server"
import { SiteMailBulkActionBar } from "~/features/site-mails/ui/bulk-action-bar"
import { SiteMailUploadModal } from "~/features/site-mails/ui/upload-modal"
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  reorderCategories,
} from "~/features/task-standards/model/task-standards.repository.server"
import { CategoryManageModal } from "~/features/task-standards/ui/category-manage-modal"
import { listSites } from "~/features/sites/model/sites.repository.server"
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

const SORT_OPTIONS: { value: SiteMailPostSort; label: string }[] = [
  { value: "sent_desc", label: "발송일 최신순" },
  { value: "sent_asc", label: "발송일 오래된순" },
  { value: "created_desc", label: "등록일 최신순" },
  { value: "created_asc", label: "등록일 오래된순" },
]

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const url = new URL(request.url)
  const categoryId = url.searchParams.get("cat") ?? undefined
  const search = url.searchParams.get("q") ?? undefined
  const sort = (url.searchParams.get("sort") as SiteMailPostSort | null) ?? "sent_desc"
  const page = Number(url.searchParams.get("page") ?? "1") || 1

  const sites = await listSites()
  const sorted = [...sites].sort((a, b) => a.sortOrder - b.sortOrder)
  const siteIdParam = url.searchParams.get("site")
  const parsedSiteId = siteIdParam ? Number(siteIdParam) : sorted[0]?.id
  const selectedSiteId = Number.isFinite(parsedSiteId) ? (parsedSiteId as number) : null
  const selectedSite = selectedSiteId !== null ? (sorted.find((site) => site.id === selectedSiteId) ?? null) : null

  const [categories, postList] = await Promise.all([
    listCategories(),
    selectedSite
      ? listSiteMailPosts({ siteId: selectedSite.id, categoryId, search, sort, page, limit: PAGE_SIZE })
      : Promise.resolve({ rows: [], total: 0, page, limit: PAGE_SIZE }),
  ])

  return {
    sites: sorted,
    selectedSite,
    categories,
    postList,
    canManageCategories: isHeadquarters(user.role),
    canWrite: selectedSite ? canWriteSite(user, selectedSite.id) : false,
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      case "category.create": {
        await requireHeadquarters(request)
        await createCategory(String(form.get("name") ?? ""), String(form.get("color") ?? "#6b7280"))
        return { ok: true }
      }
      case "category.rename": {
        await requireHeadquarters(request)
        await renameCategory(Number(form.get("id")), String(form.get("name") ?? ""), String(form.get("color") ?? "#6b7280"))
        return { ok: true }
      }
      case "category.delete": {
        await requireHeadquarters(request)
        await deleteCategory(Number(form.get("id")))
        return { ok: true }
      }
      case "category.reorder": {
        await requireHeadquarters(request)
        await reorderCategories(JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      case "post.bulkUpdate": {
        const siteId = Number(form.get("siteId"))
        const user = await requireSiteWriteAccess(request, siteId)
        const ids = JSON.parse(String(form.get("ids") ?? "[]")) as string[]
        const categoryIdRaw = form.get("categoryId")
        const fields: { categoryId?: number | null } = {}
        if (categoryIdRaw !== null) fields.categoryId = categoryIdRaw ? Number(categoryIdRaw) : null
        await bulkUpdateSiteMailPostMeta(siteId, ids, fields, user.id)
        return { ok: true }
      }
      case "post.bulkDelete": {
        const siteId = Number(form.get("siteId"))
        await requireSiteWriteAccess(request, siteId)
        const ids = JSON.parse(String(form.get("ids") ?? "[]")) as string[]
        await bulkDeleteSiteMailPosts(siteId, ids)
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

export default function SiteMailsRoute() {
  const { sites, selectedSite, categories, postList, canManageCategories, canWrite } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const catFetcher = useFetcher<typeof action>()
  const bulkFetcher = useFetcher<typeof action>()

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [qInput, setQInput] = useState(searchParams.get("q") ?? "")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedIds(new Set())
  }, [postList])

  const selectedCatParam = searchParams.get("cat") ?? ""
  const sort = (searchParams.get("sort") as SiteMailPostSort | null) ?? "sent_desc"
  const page = Number(searchParams.get("page") ?? "1") || 1
  const totalPages = Math.max(1, Math.ceil(postList.total / postList.limit))

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

  function selectSite(id: string) {
    updateParams({ site: id, cat: null, q: null })
    setQInput("")
  }

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

  const actionError =
    catFetcher.data && "error" in catFetcher.data
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

  const pageTitle = usePageMenuTitle("/site-mails", "현장 메일함")

  return (
    <div className="space-y-4">
      <PageHeader
        title={pageTitle}
        description="현장에서 발생하는 중요 메일을 현장별로 정리해 관리합니다"
        actions={
          canManageCategories ? (
            <Button variant="outline" onClick={() => setCatModalOpen(true)}>
              <Settings2 className="size-4" aria-hidden />
              구분자 관리
            </Button>
          ) : null
        }
      />

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      {sites.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="등록된 현장이 없습니다" description="현장 점검(/sites) 화면의 현장 관리에서 현장을 먼저 추가하세요." />
        </Card>
      ) : (
        <>
          <Tabs
            variant="folder"
            items={sites.map((site) => ({ value: String(site.id), label: site.name }))}
            value={selectedSite ? String(selectedSite.id) : ""}
            onChange={selectSite}
          />

          {!selectedSite ? (
            <Card className="p-5">
              <EmptyState title="현장을 찾을 수 없습니다" description="다른 탭을 선택해 보세요." />
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{selectedSite.address ?? "주소 미등록"}</p>
                {canWrite ? (
                  <Button onClick={() => setUploadModalOpen(true)}>
                    <Plus className="size-4" aria-hidden />
                    EML 업로드
                  </Button>
                ) : null}
              </div>

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
                    <EmptyState title="게시글이 없습니다" description="조건에 맞는 메일이 없습니다." />
                  ) : (
                    <Table className="table-fixed">
                      <colgroup>
                        {canWrite ? <col className="w-10" /> : null}
                        <col className="w-24" />
                        <col />
                        <col className="w-40" />
                        <col className="w-24" />
                        <col className="w-14" />
                      </colgroup>
                      <THead>
                        <TR>
                          {canWrite ? (
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
                          <TH>발신자</TH>
                          <TH>등록일</TH>
                          <TH className="text-right">첨부</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {postList.rows.map((post) => (
                          <TR key={post.id}>
                            {canWrite ? (
                              <TD>
                                <Checkbox checked={selectedIds.has(post.id)} onChange={() => toggleOne(post.id)} aria-label="선택" />
                              </TD>
                            ) : null}
                            <TD className="whitespace-nowrap">
                              {post.categoryName ? <CategoryBadge name={post.categoryName} color={post.categoryColor ?? "#6b7280"} /> : null}
                            </TD>
                            <TD className="truncate">
                              <Link to={`/site-mails/${post.id}`} className="font-medium hover:underline" title={post.title}>
                                {post.title}
                              </Link>
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

              {canWrite ? (
                <SiteMailBulkActionBar
                  count={selectedIds.size}
                  categories={categories}
                  pending={bulkFetcher.state !== "idle"}
                  onApplyCategory={(categoryId) =>
                    bulkFetcher.submit(
                      {
                        intent: "post.bulkUpdate",
                        siteId: String(selectedSite.id),
                        ids: JSON.stringify([...selectedIds]),
                        categoryId: categoryId === null ? "" : String(categoryId),
                      },
                      { method: "post" },
                    )
                  }
                  onDelete={() =>
                    bulkFetcher.submit(
                      { intent: "post.bulkDelete", siteId: String(selectedSite.id), ids: JSON.stringify([...selectedIds]) },
                      { method: "post" },
                    )
                  }
                />
              ) : null}

              {canWrite ? (
                <SiteMailUploadModal
                  open={uploadModalOpen}
                  onClose={() => setUploadModalOpen(false)}
                  siteId={selectedSite.id}
                  categories={categories}
                />
              ) : null}
            </>
          )}
        </>
      )}

      {canManageCategories ? (
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
