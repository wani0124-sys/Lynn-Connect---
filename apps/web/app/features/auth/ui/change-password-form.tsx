import { Form, useActionData, useNavigation } from "react-router"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"

interface ChangePasswordActionData {
  errors?: { newPassword?: string; confirmPassword?: string }
  formError?: string | null
}

export function ChangePasswordForm() {
  const actionData = useActionData() as ChangePasswordActionData | undefined
  const navigation = useNavigation()
  const pending = navigation.state === "submitting"

  return (
    <Form method="post" className="space-y-4">
      {actionData?.formError ? (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionData.formError}</div>
      ) : null}

      <Field label="새 비밀번호" htmlFor="newPassword" required error={actionData?.errors?.newPassword}>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!actionData?.errors?.newPassword}
        />
      </Field>

      <Field label="새 비밀번호 확인" htmlFor="confirmPassword" required error={actionData?.errors?.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!actionData?.errors?.confirmPassword}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "변경 중…" : "비밀번호 변경"}
      </Button>
    </Form>
  )
}
