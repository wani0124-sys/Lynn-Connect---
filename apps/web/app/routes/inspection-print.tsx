import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { ArrowLeft, Printer } from "lucide-react"
import { InspectionReportTable } from "~/entities/site/ui/inspection-report-table"
import { requireUser } from "~/features/auth/model/session.server"
import { getInspectionById, getSiteById } from "~/features/sites/model/sites.repository.server"
import { formatDate } from "~/shared/lib/format"
import { Button } from "~/shared/ui/button"
import { EmptyState } from "~/shared/ui/empty-state"

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request)
  const siteId = Number(params.siteId ?? "")
  const inspectionId = params.inspectionId ?? ""

  const [site, inspection] = await Promise.all([getSiteById(siteId), getInspectionById(inspectionId)])
  if (!site || !inspection || inspection.siteId !== siteId) {
    return { site: null, inspection: null }
  }
  return { site, inspection }
}

export default function InspectionPrintRoute() {
  const { site, inspection } = useLoaderData<typeof loader>()

  if (!site || !inspection) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState title="점검 기록을 찾을 수 없습니다." description="삭제되었거나 잘못된 주소입니다." />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-muted/40 p-4 print:bg-white print:p-0 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link to={`/sites?site=${site.id}`}>
            <Button variant="outline">
              <ArrowLeft className="size-4" aria-hidden />
              현장으로 돌아가기
            </Button>
          </Link>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            인쇄
          </Button>
        </div>

        <div className="border-2 border-foreground bg-card p-0 print:border-black">
          <div className="border-b-2 border-foreground p-4 text-center print:border-black">
            <h1 className="text-xl font-bold">
              [{site.name}] {inspection.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">(작성일: {formatDate(inspection.createdAt)})</p>
          </div>
          <p className="border-b border-foreground px-4 py-1.5 text-sm print:border-black">■ {site.name} 현장</p>

          <InspectionReportTable inspection={inspection} />
        </div>

        {inspection.attachments.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">첨부파일</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
              {inspection.attachments.map((att) => (
                <li key={att.id}>{att.filename}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
