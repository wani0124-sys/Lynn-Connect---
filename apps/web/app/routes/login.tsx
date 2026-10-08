import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { Waypoints } from "lucide-react"
import { loginSchema } from "~/features/auth/model/login.schema"
import {
  createUserSession,
  getUserId,
  safeRedirect,
} from "~/features/auth/model/session.server"
import { verifyCredentials } from "~/features/auth/model/credentials.server"
import { LoginForm } from "~/features/auth/ui/login-form"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request)
  if (userId) throw redirect("/")
  return null
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")
  const redirectTo = safeRedirect(form.get("redirectTo"))

  const parsed = loginSchema.safeParse({ email, password })
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    return data(
      {
        errors: { email: errors.email?.[0], password: errors.password?.[0] },
        formError: null,
        values: { email },
      },
      { status: 400 },
    )
  }

  const userId = await verifyCredentials(parsed.data.email, parsed.data.password)
  if (!userId) {
    return data(
      {
        errors: {},
        formError: "이메일 또는 비밀번호가 올바르지 않습니다.",
        values: { email },
      },
      { status: 400 },
    )
  }

  return createUserSession(userId, redirectTo)
}

export default function LoginRoute() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* 배경 영상: 소리 없이 반복 재생. 파일이 없거나 움직임 줄이기 설정이면 남색 배경만 보인다. */}
      <video
        className="pointer-events-none absolute inset-0 size-full object-cover motion-reduce:hidden"
        src="/videos/login-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/70" aria-hidden />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waypoints className="size-5" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Lynn-Connect</h1>
          <p className="text-sm text-white/70">관리자 콘솔에 로그인</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
