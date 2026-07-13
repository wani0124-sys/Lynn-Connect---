import { Link } from "react-router"
import { Compass } from "lucide-react"
import { Button } from "~/shared/ui/button"

export default function NotFoundRoute() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <Compass className="size-10 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">페이지를 찾을 수 없습니다</h1>
          <p className="text-sm text-muted-foreground">
            주소가 바뀌었거나 삭제된 페이지일 수 있습니다.
          </p>
        </div>
        <Link to="/">
          <Button variant="outline">대시보드로 이동</Button>
        </Link>
      </div>
    </div>
  )
}
