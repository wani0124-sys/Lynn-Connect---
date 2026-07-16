import { FileQuestion } from "lucide-react"
import { Link, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { requireUser } from "~/features/auth/model/session.server"
import { findMenuItemByRoute } from "~/features/sidebar-menu/model/sidebar-menu.repository.server"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { EmptyState } from "~/shared/ui/empty-state"
import { PageHeader } from "~/shared/ui/page-header"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  if (user.mustChangePassword) throw redirect("/change-password")
  const menuItem = await findMenuItemByRoute(`/menu/${params.slug}`)
  return { menuItem }
}

// 관리자가 메뉴 관리 화면에서 즉석으로 만든, 아직 실제 화면이 없는 하위 메뉴가 연결되는 공통 스캐폴드 화면이다.
export default function MenuPlaceholderRoute() {
  const { menuItem } = useLoaderData<typeof loader>()

  if (!menuItem) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title="메뉴를 찾을 수 없습니다."
          description="삭제되었거나 잘못된 주소입니다."
          action={
            <Link to="/">
              <Button variant="outline">대시보드로</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title={menuItem.label} description="관리자가 사이드바 메뉴 관리에서 추가한 항목입니다." />
      <Card className="p-5">
        <EmptyState
          icon={<FileQuestion className="size-8" aria-hidden />}
          title="아직 준비 중인 기능입니다"
          description="이 메뉴에는 실제 화면이 아직 연결되지 않았습니다. 필요한 기능을 개발팀에 요청해 주세요."
        />
      </Card>
    </div>
  )
}
