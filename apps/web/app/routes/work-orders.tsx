import { ClipboardEdit } from "lucide-react"
import { redirect, type LoaderFunctionArgs } from "react-router"
import { usePageMenuTitle } from "~/entities/sidebar-menu/lib/use-page-menu-title"
import { requireUser } from "~/features/auth/model/session.server"
import { Card } from "~/shared/ui/card"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  if (user.mustChangePassword) throw redirect("/change-password")
  return null
}

// 스캐폴드 화면(2026-07-16). 본사가 특정 현장에 작업 지시를 발령하는 실제 기능은 별도 작업에서 구현한다.
export default function WorkOrdersRoute() {
  const pageTitle = usePageMenuTitle("/work-orders", "작업지시서")

  return (
    <div className="space-y-4">
      <PageHeader title={pageTitle} description="본사가 현장에 발령하는 작업 지시를 관리합니다" />
      <Card className="p-5">
        <EmptyState
          icon={<ClipboardEdit className="size-8" aria-hidden />}
          title="아직 준비 중인 기능입니다"
          description="작업지시서 기능은 곧 추가될 예정입니다."
        />
      </Card>
    </div>
  )
}
