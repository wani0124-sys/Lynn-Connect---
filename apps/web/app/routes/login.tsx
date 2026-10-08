import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { loginSchema } from "~/features/auth/model/login.schema"
import {
  createUserSession,
  getUserId,
  safeRedirect,
} from "~/features/auth/model/session.server"
import { verifyCredentials } from "~/features/auth/model/credentials.server"
import { AuthShell } from "~/features/auth/ui/auth-shell"
import { LoginForm } from "~/features/auth/ui/login-form"

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

  const result = await verifyCredentials(parsed.data.email, parsed.data.password)
  if (!result.ok) {
    return data(
      {
        errors: {},
        formError:
          result.reason === "pending"
            ? "가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다."
            : "이메일 또는 비밀번호가 올바르지 않습니다.",
        values: { email },
      },
      { status: 400 },
    )
  }

  return createUserSession(result.id, redirectTo)
}

export default function LoginRoute() {
  return (
    <AuthShell title="로그인">
      <LoginForm />
    </AuthShell>
  )
}
