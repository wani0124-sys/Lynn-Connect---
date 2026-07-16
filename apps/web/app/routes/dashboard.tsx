import { useEffect, useState } from "react"
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { FileText, Mail } from "lucide-react"
import { MEMBER_ROLE_LABEL, type Member } from "~/entities/member/model/member"
import type { SeriesWithLatestRevision } from "~/entities/document/model/document.types"
import type { SiteWithLatestInspection } from "~/entities/site/model/site.types"
import { InspectionResultBadge } from "~/entities/site/ui/inspection-result-badge"
import { usePageMenuTitle } from "~/entities/sidebar-menu/lib/use-page-menu-title"
import { requireUser } from "~/features/auth/model/session.server"
import { listSeriesWithLatestRevision } from "~/features/documents/model/documents.repository.server"
import { listSitesWithLatestInspection } from "~/features/sites/model/sites.repository.server"
import { listCategories, listPosts } from "~/features/task-standards/model/task-standards.repository.server"
import type { StandardPostListItem } from "~/entities/task-standard/model/task-standard.types"
import { cn } from "~/shared/lib/cn"
import { formatDate } from "~/shared/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { PageHeader } from "~/shared/ui/page-header"

const STANDARDS_HIGHLIGHT_LIMIT = 3
const STANDARDS_HIGHLIGHT_CATEGORY_NAMES = ["업무기준", "시공기준"] as const
const DOCUMENTS_HIGHLIGHT_LIMIT = 6
const SITES_HIGHLIGHT_LIMIT = 6

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const categories = await listCategories()

  const standardsHighlight = await Promise.all(
    STANDARDS_HIGHLIGHT_CATEGORY_NAMES.map(async (name) => {
      const category = categories.find((c) => c.name === name)
      const postList = category
        ? await listPosts({ categoryId: String(category.id), sort: "sent_desc", page: 1, limit: STANDARDS_HIGHLIGHT_LIMIT })
        : { rows: [], total: 0, page: 1, limit: STANDARDS_HIGHLIGHT_LIMIT }
      return { label: name, categoryId: category?.id ?? null, posts: postList.rows, total: postList.total }
    }),
  )

  // documents/document_revisions migration이 아직 적용되지 않은 환경에서도 나머지 대시보드는 뜨도록 방어한다.
  let documentsHighlight: SeriesWithLatestRevision[] = []
  try {
    const allSeries = await listSeriesWithLatestRevision()
    documentsHighlight = allSeries.slice(0, DOCUMENTS_HIGHLIGHT_LIMIT)
  } catch (error) {
    console.error("문서 목록을 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
  }

  // sites/site_inspections migration이 아직 적용되지 않은 환경에서도 나머지 대시보드는 뜨도록 방어한다.
  let sitesHighlight: SiteWithLatestInspection[] = []
  try {
    const allSites = await listSitesWithLatestInspection()
    sitesHighlight = allSites.slice(0, SITES_HIGHLIGHT_LIMIT)
  } catch (error) {
    console.error("현장 목록을 불러오지 못했습니다(마이그레이션 미적용 가능성):", error)
  }

  return { user, standardsHighlight, documentsHighlight, sitesHighlight }
}

type MissionSlide = {
  labelEn: string
  labelKo: string
  type: "single"
  lines: string[]
  sub?: string
}

type CoreValuesSlide = {
  labelEn: string
  labelKo: string
  type: "columns"
  columns: { labelEn: string; text: string }[]
}

const COMPANY_SLIDES: (MissionSlide | CoreValuesSlide)[] = [
  {
    labelEn: "MISSION",
    labelKo: "미션",
    type: "single",
    lines: ["우리는 사람·자연·역사에 대한 통찰을 바탕으로", "고객의 꿈과 행복을 위해 더 나은 공간의 가치를 창조한다"],
  },
  {
    labelEn: "VISION",
    labelKo: "비전",
    type: "single",
    lines: ["선도적인 일류 종합부동산 회사"],
    sub: "PREMIER SPACE & VALUE CREATOR",
  },
  {
    labelEn: "CORE VALUES",
    labelKo: "핵심가치",
    type: "columns",
    columns: [
      { labelEn: "TRUST", text: "마음을 얻는 신뢰" },
      { labelEn: "LEARNING", text: "미래를 여는 학습" },
      { labelEn: "CHALLENGE", text: "최고를 향한 도전" },
    ],
  },
]

const COMPANY_SLIDE_INTERVAL_MS = 5000

// 회사 미션/비전/핵심가치를 일정 주기로 자동 전환하며 보여주는 배너. 대시보드 상단에서 개인 인사 배너보다 먼저 노출한다.
function CompanyMissionCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % COMPANY_SLIDES.length), COMPANY_SLIDE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [paused])

  const slide = COMPANY_SLIDES[index]

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary via-primary to-[#0d4d7a] px-6 py-5 text-primary-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex min-h-16 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 items-center gap-3 sm:border-r sm:border-primary-foreground/20 sm:pr-6">
          <span className="text-xs font-semibold tracking-wider text-primary-foreground/70">{slide.labelEn}</span>
          <span className="text-base font-bold">{slide.labelKo}</span>
        </div>

        {slide.type === "single" ? (
          <div className="min-w-0 flex-1 space-y-1">
            {slide.lines.map((line) => (
              <p key={line} className="text-sm font-medium sm:text-base">
                {line}
              </p>
            ))}
            {slide.sub ? <p className="text-xs font-semibold tracking-wide text-primary-foreground/70">{slide.sub}</p> : null}
          </div>
        ) : (
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            {slide.columns.map((col) => (
              <div key={col.labelEn}>
                <p className="text-xs font-semibold tracking-wider text-primary-foreground/70">{col.labelEn}</p>
                <p className="text-sm font-bold sm:text-base">{col.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {COMPANY_SLIDES.map((s, i) => (
          <button
            key={s.labelEn}
            type="button"
            aria-label={`${s.labelKo} 슬라이드로 이동`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-primary-foreground" : "bg-primary-foreground/30")}
          />
        ))}
      </div>
    </div>
  )
}

function DashboardBanner({ user }: { user: Member }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = time.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const timeStr = time.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })

  return (
    <div className="rounded-lg bg-primary px-6 py-4 text-primary-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-primary-foreground/30 bg-primary-foreground/10 text-lg font-bold">
            {user.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs opacity-90">{MEMBER_ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{dateStr}</p>
          <p className="text-lg font-bold">{timeStr}</p>
        </div>
      </div>
    </div>
  )
}

function StandardsMailList({
  label,
  categoryId,
  posts,
}: {
  label: string
  categoryId: number | null
  posts: StandardPostListItem[]
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Link
          to={categoryId ? `/standards?cat=${categoryId}` : "/standards"}
          className="text-xs font-medium text-muted-foreground hover:text-primary"
        >
          더보기 +
        </Link>
      </div>
      {posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">게시글이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 py-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Link to={`/standards/${post.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                {post.title}
              </Link>
              <span className="w-16 shrink-0 truncate text-right text-sm font-medium text-foreground">
                {post.senderName ?? "-"}
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                {formatDate(post.sentAt ?? post.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StandardsHighlightBanner({
  highlight,
}: {
  highlight: { label: string; categoryId: number | null; posts: StandardPostListItem[]; total: number }[]
}) {
  const title = usePageMenuTitle("/standards", "부서별 업무기준 (메일공지)")
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b border-border bg-accent pb-5">
        <CardTitle>{title}</CardTitle>
        <Link to="/standards" className="text-sm font-medium text-primary hover:underline">
          전체 보기
        </Link>
      </CardHeader>
      <CardContent className="grid gap-6 pt-5 sm:grid-cols-2">
        {highlight.map((section) => (
          <StandardsMailList
            key={section.label}
            label={section.label}
            categoryId={section.categoryId}
            posts={section.posts}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function DocumentsHighlightBanner({ documents }: { documents: SeriesWithLatestRevision[] }) {
  const title = usePageMenuTitle("/documents", "문서 관리")
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b border-border bg-accent pb-5">
        <CardTitle>{title}</CardTitle>
        <Link to="/documents" className="text-sm font-medium text-primary hover:underline">
          전체 보기
        </Link>
      </CardHeader>
      <CardContent className="pt-5">
        {documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">등록된 문서가 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((item) => (
              <Link
                key={item.id}
                to={`/documents?series=${item.id}`}
                className="min-w-0 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="min-w-0 truncate text-sm font-semibold text-foreground">{item.name}</p>
                </div>
                {item.latestRevision ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {item.latestRevision.revisionLabel}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.latestRevision.createdAt)}</span>
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">업로드된 리비전 없음</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SitesHighlightBanner({ sites }: { sites: SiteWithLatestInspection[] }) {
  const title = usePageMenuTitle("/sites", "현장 점검")
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b border-border bg-accent pb-5">
        <CardTitle>{title}</CardTitle>
        <Link to="/sites" className="text-sm font-medium text-primary hover:underline">
          전체 보기
        </Link>
      </CardHeader>
      <CardContent className="pt-5">
        {sites.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">등록된 현장이 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <Link
                key={site.id}
                to={`/sites?site=${site.id}`}
                className="min-w-0 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
              >
                <p className="truncate text-sm font-semibold text-foreground">{site.name}</p>
                {site.latestInspection ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{site.latestInspection.title}</span>
                    <InspectionResultBadge result={site.latestInspection.result} />
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">점검 기록 없음</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardRoute() {
  const { user, standardsHighlight, documentsHighlight, sitesHighlight } = useLoaderData<typeof loader>()

  return (
    <div className="space-y-6">
      <CompanyMissionCarousel />
      <DashboardBanner user={user} />

      <PageHeader title="대시보드" description={`${user.name}님, 환영합니다.`} />

      <StandardsHighlightBanner highlight={standardsHighlight} />
      <DocumentsHighlightBanner documents={documentsHighlight} />
      <SitesHighlightBanner sites={sitesHighlight} />
    </div>
  )
}
