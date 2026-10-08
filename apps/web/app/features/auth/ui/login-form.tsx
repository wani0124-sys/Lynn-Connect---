import { Form, Link, useActionData, useNavigation, useSearchParams } from "react-router"
import { AUTH_INPUT_CLASS } from "~/features/auth/ui/auth-shell"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"

interface LoginActionData {
  errors?: { email?: string; password?: string }
  formError?: string | null
  values?: { email?: string }
}

export function LoginForm() {
  const actionData = useActionData() as LoginActionData | undefined
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") ?? "/"
  const pending = navigation.state === "submitting"
  // 회원가입 신청을 마치고 넘어온 경우 안내를 띄운다.
  const signedUp = searchParams.get("signedUp") === "1"

  return (
    <Form method="post" className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {signedUp && !actionData ? (
        <div className="rounded-md bg-success/15 px-3 py-2 text-sm text-emerald-300">
          가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.
        </div>
      ) : null}

      {actionData?.formError ? (
        <div className="rounded-md bg-danger/15 px-3 py-2 text-sm text-red-300">{actionData.formError}</div>
      ) : null}

      <Field label="이메일" htmlFor="email" required error={actionData?.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@wm.co.kr"
          defaultValue={actionData?.values?.email}
          aria-invalid={!!actionData?.errors?.email}
          className={AUTH_INPUT_CLASS}
        />
      </Field>

      <Field label="비밀번호" htmlFor="password" required error={actionData?.errors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={!!actionData?.errors?.password}
          className={AUTH_INPUT_CLASS}
        />
      </Field>

      <Button type="submit" className="h-11 w-full bg-[#0a4fa8] hover:bg-[#0b5cc4]" disabled={pending}>
        {pending ? "로그인 중…" : "로그인"}
      </Button>

      <p className="text-center text-sm text-slate-400">
        계정이 없으신가요?{" "}
        <Link to="/signup" className="font-semibold text-white underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </Form>
  )
}
