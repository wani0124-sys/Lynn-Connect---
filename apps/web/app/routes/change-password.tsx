import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { ShieldAlert } from "lucide-react"
import { updateMember } from "~/entities/member/model/member"
import { changePasswordSchema } from "~/features/auth/model/change-password.schema"
import { setPassword } from "~/features/auth/model/credentials.server"
import { requireUser } from "~/features/auth/model/session.server"
import { ChangePasswordForm } from "~/features/auth/ui/change-password-form"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  if (!user.mustChangePassword) throw redirect("/")
  return null
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request)
  const form = await request.formData()
  const parsed = changePasswordSchema.safeParse({
    newPassword: String(form.get("newPassword") ?? ""),
    confirmPassword: String(form.get("confirmPassword") ?? ""),
  })

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    return data(
      { errors: { newPassword: errors.newPassword?.[0], confirmPassword: errors.confirmPassword?.[0] }, formError: null },
      { status: 400 },
    )
  }

  setPassword(user.email, parsed.data.newPassword)
  updateMember(user.id, { mustChangePassword: false, status: user.status === "invited" ? "active" : user.status })

  return redirect("/")
}

export default function ChangePasswordRoute() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-warning/10 text-warning">
            <ShieldAlert className="size-5" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">비밀번호 변경이 필요합니다</h1>
          <p className="text-sm text-muted-foreground">
            관리자가 발급한 임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호로 변경하세요.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>새 비밀번호 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
