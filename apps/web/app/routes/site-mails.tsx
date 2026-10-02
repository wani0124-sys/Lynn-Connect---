import { useEffect, useState } from "react"
import { Link, data, useFetcher, useLoaderData, useSearchParams, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { Plus, Search, Settings2 } from "lucide-react"
import { isHeadquarters } from "~/entities/member/model/member"
import { usePageMenuTitle } from "~/entities/sidebar-menu/lib/use-page-menu-title"
import { CategoryBadge } from "~/entities/task-standard/ui/category-badge"
import type { SiteMailPostSort } from "~/entities/site-mail/model/site-mail.types"
import { requireHeadquarters, requireUser } from "~/features/auth/model/session.server"
import { listMembers } from "~/features/members/model/members.repository.server"
import { canViewSiteMail, canWriteSiteMail, requireSiteMailWriteAccess } from "~/features/site-mails/model/site-mail-access.server"
import {
  assertSiteMailCategory,
  createSiteMailCategory,
  deleteSiteMailCategory,
  listSiteMailCategories,
  renameSiteMailCategory,
  reorderSiteMailCategories,
} from "~/features/site-mails/model/site-mail-categories.repository.server"
import {
  createSiteMailSite,
  deleteSiteMailSite,
  listSiteMailSites,
  renameSiteMailSite,
  reorderSiteMailSites,
  setSiteMailSiteWriters,
} from "~/features/site-mails/model/site-mail-sites.repository.server"
import {
  bulkDeleteSiteMailPosts,
  bulkUpdateSiteMailPostMeta,
  listSiteMailPosts,
} from "~/features/site-mails/model/site-mails.repository.server"
import { SiteMailBulkActionBar } from "~/features/site-mails/ui/bulk-action-bar"
import { SiteMailSiteManageModal } from "~/features/site-mails/ui/site-manage-modal"
import { SiteMailUploadModal } from "~/features/site-mails/ui/upload-modal"
import { CategoryManageModal } from "~/features/task-standards/ui/category-manage-modal"
import { validateSiteName } from "~/features/sites/model/sites.schema"
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

  const canManageSites = isHeadquarters(user.role)
  const [allSites, members] = await Promise.all([listSiteMailSites(), canManageSites ? listMembers() : Promise.resolve([])])
  // 현장 계정은 담당 현장만 탭으로 보인다(다른 현장 id를 ?site=로 넣어도 아래에서 첫 담당 현장으로 대체된다).
  const sorted = allSites.filter((site) => canViewSiteMail(user, site))
  const siteIdParam = url.searchParams.get("site")
  const parsedSiteId = siteIdParam ? Number(siteIdParam) : sorted[0]?.id
  const selectedSiteId = Number.isFinite(parsedSiteId) ? (parsedSiteId as number) : null
  // 선택한 현장이 방금 삭제됐거나 잘못된 값이면 첫 번째 현장으로 대체한다.
  const selectedSite =
    (selectedSiteId !== null ? sorted.find((site) => site.id === selectedSiteId) : undefined) ?? sorted[0] ?? null

  const [categories, postList] = await Promise.all([
    selectedSite ? listSiteMailCategories(selectedSite.id) : Promise.resolve([]),
    selectedSite
      ? listSiteMailPosts({ siteId: selectedSite.id, categoryId, search, sort, page, limit: PAGE_SIZE })
      : Promise.resolve({ rows: [], total: 0, page, limit: PAGE_SIZE }),
  ])

  return {
    sites: sorted,
    selectedSite,
    categories,
    postList,
    canManageSites,
    // 담당자로 지정할 수 있는 현장 계정(본사 계정은 항상 쓰기 가능하므로 후보에서 제외).
    writerCandidates: members
      .filter((member) => !isHeadquarters(member.role))
      .map((member) => ({ id: member.id, name: member.name, email: member.email })),
    canWrite: selectedSite ? canWriteSiteMail(user, selectedSite) : false,
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const intent = String(form.get("intent") ?? "")

  try {
    switch (intent) {
      // 메일함 전용 현장 목록(site_mail_sites). 대외기관 점검(/sites)의 현장과 연동되지 않는다.
      case "site.create": {
        await requireHeadquarters(request)
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSiteName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await createSiteMailSite(name)
        return { ok: true }
      }
      case "site.rename": {
        await requireHeadquarters(request)
        const name = String(form.get("name") ?? "").trim()
        const validationError = validateSiteName(name)
        if (validationError) return data({ error: validationError }, { status: 400 })
        await renameSiteMailSite(Number(form.get("id")), name)
        return { ok: true }
      }
      case "site.delete": {
        await requireHeadquarters(request)
        await deleteSiteMailSite(Number(form.get("id")))
        return { ok: true }
      }
      case "site.reorder": {
        await requireHeadquarters(request)
        await reorderSiteMailSites(JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      case "site.setWriters": {
        await requireHeadquarters(request)
        const memberIds = JSON.parse(String(form.get("memberIds") ?? "[]")) as string[]
        await setSiteMailSiteWriters(Number(form.get("id")), memberIds)
        return { ok: true }
      }
      // 메일함 현장별 구분자(site_mail_categories.site_id). 부서별 업무기준·다른 현장의 구분자와 연동되지 않는다.
      // 그 현장에 쓸 수 있는 계정(본사 또는 담당자)이 자기 현장 구분자를 직접 관리한다.
      case "category.create": {
        const siteId = Number(form.get("siteId"))
        await requireSiteMailWriteAccess(request, siteId)
        await createSiteMailCategory(siteId, String(form.get("name") ?? ""), String(form.get("color") ?? "#6b7280"))
        return { ok: true }
      }
      case "category.rename": {
        const siteId = Number(form.get("siteId"))
        await requireSiteMailWriteAccess(request, siteId)
        await renameSiteMailCategory(siteId, Number(form.get("id")), String(form.get("name") ?? ""), String(form.get("color") ?? "#6b7280"))
        return { ok: true }
      }
      case "category.delete": {
        const siteId = Number(form.get("siteId"))
        await requireSiteMailWriteAccess(request, siteId)
        await deleteSiteMailCategory(siteId, Number(form.get("id")))
        return { ok: true }
      }
      case "category.reorder": {
        const siteId = Number(form.get("siteId"))
        await requireSiteMailWriteAccess(request, siteId)
        await reorderSiteMailCategories(siteId, JSON.parse(String(form.get("items") ?? "[]")))
        return { ok: true }
      }
      case "post.bulkUpdate": {
        const siteId = Number(form.get("siteId"))
        const { user } = await requireSiteMailWriteAccess(request, siteId)
        const ids = JSON.parse(String(form.get("ids") ?? "[]")) as string[]
        const categoryIdRaw = form.get("categoryId")
        const fields: { categoryId?: number | null } = {}
        if (categoryIdRaw !== null) fields.categoryId = categoryIdRaw ? Number(categoryIdRaw) : null
        if (fields.categoryId !== undefined) await assertSiteMailCategory(siteId, fields.categoryId)
        await bulkUpdateSiteMailPostMeta(siteId, ids, fields, user.id)
        return { ok: true }
      }
      case "post.bulkDelete": {
        const siteId = Number(form.get("siteId"))
        await requireSiteMailWriteAccess(request, siteId)
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
  const { sites, selectedSite, categories, postList, canManageSites, writerCandidates, canWrite } =
    useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const catFetcher = useFetcher<typeof action>()
  const bulkFetcher = useFetcher<typeof action>()
  const siteFetcher = useFetcher<typeof action>()

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [siteModalOpen, setSiteModalOpen] = useState(false)
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
    [catFetcher.data, bulkFetcher.data, siteFetcher.data].find(
      (result): result is { error: string } => !!result && "error" in result,
    )?.error ?? null

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
          canManageSites ? (
            <Button variant="outline" onClick={() => setSiteModalOpen(true)}>
              <Settings2 className="size-4" aria-hidden />
              현장 관리
            </Button>
          ) : null
        }
      />

      {actionError ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div> : null}

      {sites.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            title={canManageSites ? "등록된 현장이 없습니다" : "담당 현장이 없습니다"}
            description={
              canManageSites
                ? "우측 상단의 현장 관리에서 현장을 먼저 추가하세요."
                : "본사 관리자에게 멤버 관리에서 소속 현장(현장별 메일함) 지정을 요청하세요."
            }
          />
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
                <Tabs items={catTabs} value={selectedCatParam} onChange={(value) => updateParams({ cat: value || null })} />
                {canWrite ? (
                  <Button variant="outline" onClick={() => setCatModalOpen(true)}>
                    <Settings2 className="size-4" aria-hidden />
                    구분자 관리
                  </Button>
                ) : null}
              </div>

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
                  <div className="flex items-center gap-2">
                    <Select value={sort} onChange={(e) => updateParams({ sort: e.target.value })} aria-label="정렬">
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    {canWrite ? (
                      <Button className="shrink-0" onClick={() => setUploadModalOpen(true)}>
                        <Plus className="size-4" aria-hidden />
                        EML 업로드
                      </Button>
                    ) : null}
                  </div>
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

      {canManageSites ? (
        <SiteMailSiteManageModal
          open={siteModalOpen}
          onClose={() => setSiteModalOpen(false)}
          sites={sites}
          writerCandidates={writerCandidates}
          pending={siteFetcher.state !== "idle"}
          onCreate={(name) => siteFetcher.submit({ intent: "site.create", name }, { method: "post" })}
          onRename={(id, name) => siteFetcher.submit({ intent: "site.rename", id: String(id), name }, { method: "post" })}
          onSetWriters={(id, memberIds) =>
            siteFetcher.submit({ intent: "site.setWriters", id: String(id), memberIds: JSON.stringify(memberIds) }, { method: "post" })
          }
          onDelete={(id) => siteFetcher.submit({ intent: "site.delete", id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) siteFetcher.submit({ intent: "site.reorder", items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}

      {canWrite && selectedSite ? (
        <CategoryManageModal
          open={catModalOpen}
          onClose={() => setCatModalOpen(false)}
          categories={categories}
          pending={catFetcher.state !== "idle"}
          onCreate={(name, color) => catFetcher.submit({ intent: "category.create", siteId: String(selectedSite.id), name, color }, { method: "post" })}
          onRename={(id, name, color) =>
            catFetcher.submit({ intent: "category.rename", siteId: String(selectedSite.id), id: String(id), name, color }, { method: "post" })
          }
          onDelete={(id) => catFetcher.submit({ intent: "category.delete", siteId: String(selectedSite.id), id: String(id) }, { method: "post" })}
          onReorder={(items) => {
            if (items.length) catFetcher.submit({ intent: "category.reorder", siteId: String(selectedSite.id), items: JSON.stringify(items) }, { method: "post" })
          }}
        />
      ) : null}
    </div>
  )
}
