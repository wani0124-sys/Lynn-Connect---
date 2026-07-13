import { Link } from "react-router"
import { ShieldAlert } from "lucide-react"
import { Button } from "~/shared/ui/button"

export default function ForbiddenRoute() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <ShieldAlert className="size-10 text-warning" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">접근 권한이 없습니다</h1>
          <p className="text-sm text-muted-foreground">
            이 페이지를 볼 수 있는 권한이 없습니다. 필요한 경우 관리자에게 문의하세요. (로그인이 필요한 경우와 구분됩니다.)
          </p>
        </div>
        <Link to="/">
          <Button>대시보드로 이동</Button>
        </Link>
      </div>
    </div>
  )
}
