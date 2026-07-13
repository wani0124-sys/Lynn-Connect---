import { Form, useActionData, useNavigation, useSearchParams } from "react-router"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"

interface DemoAccount {
  email: string
  password: string
  role: string
}

interface LoginActionData {
  errors?: { email?: string; password?: string }
  formError?: string | null
  values?: { email?: string }
}

export function LoginForm({ demoAccounts }: { demoAccounts: DemoAccount[] }) {
  const actionData = useActionData() as LoginActionData | undefined
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") ?? "/"
  const pending = navigation.state === "submitting"

  return (
    <div className="space-y-4">
      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        {actionData?.formError ? (
          <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {actionData.formError}
          </div>
        ) : null}

        <Field label="이메일" htmlFor="email" required error={actionData?.errors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="admin@woomi.dev"
            defaultValue={actionData?.values?.email}
            aria-invalid={!!actionData?.errors?.email}
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
          />
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "로그인 중…" : "로그인"}
        </Button>
      </Form>

      <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">데모 계정</p>
        {demoAccounts.map((account) => (
          <p key={account.email}>
            <span className="font-mono">{account.email}</span> /{" "}
            <span className="font-mono">{account.password}</span> · {account.role}
          </p>
        ))}
        <p className="pt-1">
          로그인 후 <span className="font-medium text-foreground">구성원</span> 메뉴에서 계정을 추가·수정할
          수 있습니다. 실제 인증은 백엔드 API로 교체하세요.
        </p>
      </div>
    </div>
  )
}
