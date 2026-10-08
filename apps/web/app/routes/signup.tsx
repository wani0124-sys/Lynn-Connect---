import { useState } from "react"
import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router"
import { MEMBER_GROUP_LABEL, type CreatableMemberRole } from "~/entities/member/model/member"
import { hashPassword } from "~/features/auth/model/credentials.server"
import { getUserId } from "~/features/auth/model/session.server"
import { SIGNUP_EMAIL_DOMAIN, signupSchema } from "~/features/auth/model/signup.schema"
import { AUTH_INPUT_CLASS, AuthShell } from "~/features/auth/ui/auth-shell"
import { createMember, getMemberByEmail } from "~/features/members/model/members.repository.server"
import { listSiteMailSites, setMemberSiteMailSite } from "~/features/site-mails/model/site-mail-sites.repository.server"
import { listSites } from "~/features/sites/model/sites.repository.server"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Select } from "~/shared/ui/select"

// 로그인 전 화면이라 현장은 고르는 데 필요한 id·이름만 내려준다.
export async function loader({ request }: LoaderFunctionArgs) {
  if (await getUserId(request)) throw redirect("/")
  let sites: { id: number; name: string }[] = []
  let mailSites: { id: number; name: string }[] = []
  try {
    const [siteRows, mailSiteRows] = await Promise.all([listSites(), listSiteMailSites()])
    sites = siteRows.map((site) => ({ id: site.id, name: site.name }))
    mailSites = mailSiteRows.map((site) => ({ id: site.id, name: site.name }))
  } catch (error) {
    console.error("회원가입 현장 목록을 불러오지 못했습니다:", error)
  }
  return { sites, mailSites }
}

type SignupField = "name" | "emailId" | "password" | "confirmPassword" | "role" | "siteId"

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  return value ? Number(value) : null
}

function toTextOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim()
  return text || null
}

// 가입 신청은 승인 대기(pending) 계정으로 저장한다. 본사관리자 또는 해당 현장 마스터가 /members에서 승인한다.
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const parsed = signupSchema.safeParse({
    name: String(form.get("name") ?? ""),
    emailId: String(form.get("emailId") ?? ""),
    password: String(form.get("password") ?? ""),
    confirmPassword: String(form.get("confirmPassword") ?? ""),
    role: String(form.get("role") ?? ""),
    siteId: toNumberOrNull(form.get("siteId")),
    mailSiteId: toNumberOrNull(form.get("mailSiteId")),
    position: toTextOrNull(form.get("position")),
    department: toTextOrNull(form.get("department")),
  })
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const errors: Partial<Record<SignupField, string>> = {}
    for (const key of ["name", "emailId", "password", "confirmPassword", "role", "siteId"] as const) {
      if (fieldErrors[key]?.[0]) errors[key] = fieldErrors[key][0]
    }
    return data({ errors, formError: null }, { status: 400 })
  }

  const input = parsed.data
  const role: CreatableMemberRole = input.role
  const email = `${input.emailId}@${SIGNUP_EMAIL_DOMAIN}`
  const siteId = role === "member" ? input.siteId : null
  const mailSiteId = role === "member" ? input.mailSiteId : null

  try {
    if (await getMemberByEmail(email)) {
      return data({ errors: { emailId: "이미 등록되었거나 신청한 이메일입니다." }, formError: null }, { status: 400 })
    }
    const created = await createMember({
      name: input.name,
      email,
      role,
      status: "pending",
      siteId,
      position: input.position,
      department: input.department,
      menuPermission: role === "manager" ? "all" : "limited",
      managedSiteIds: role === "member" ? (siteId !== null ? [siteId] : []) : null,
      passwordHash: hashPassword(input.password),
      joinedAt: new Date().toISOString().slice(0, 10),
      // 본인이 정한 비밀번호라 승인 후 바로 쓸 수 있다.
      mustChangePassword: false,
      isSiteMaster: false,
    })
    if (mailSiteId !== null) await setMemberSiteMailSite(created.id, mailSiteId)
  } catch (error) {
    const message = error instanceof Error ? error.message : "가입 신청을 처리하지 못했습니다."
    return data({ errors: {}, formError: message }, { status: 400 })
  }

  throw redirect("/login?signedUp=1")
}

export default function SignupRoute() {
  const { sites, mailSites } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const errors: Partial<Record<SignupField, string>> = actionData?.errors ?? {}
  const pending = useNavigation().state === "submitting"
  const [role, setRole] = useState<CreatableMemberRole>("member")

  return (
    <AuthShell title="회원가입 신청">
      <Form method="post" className="space-y-4">
        {actionData?.formError ? (
          <div className="rounded-md bg-danger/15 px-3 py-2 text-sm text-red-300">{actionData.formError}</div>
        ) : null}

        <Field label="이름" htmlFor="name" required error={errors.name}>
          <Input id="name" name="name" autoComplete="name" aria-invalid={!!errors.name} className={AUTH_INPUT_CLASS} />
        </Field>

        <Field label="아이디" htmlFor="emailId" required error={errors.emailId} hint="회사 메일 주소로만 가입할 수 있습니다.">
          <div className="flex items-center gap-2">
            <Input
              id="emailId"
              name="emailId"
              autoComplete="username"
              placeholder="아이디"
              aria-invalid={!!errors.emailId}
              className={AUTH_INPUT_CLASS}
            />
            <span className="shrink-0 text-sm text-slate-300">@{SIGNUP_EMAIL_DOMAIN}</span>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="비밀번호" htmlFor="password" required error={errors.password}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              className={AUTH_INPUT_CLASS}
            />
          </Field>
          <Field label="비밀번호 확인" htmlFor="confirmPassword" required error={errors.confirmPassword}>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              className={AUTH_INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="구분" htmlFor="role" required error={errors.role}>
          <Select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as CreatableMemberRole)}
            className={`w-full ${AUTH_INPUT_CLASS}`}
          >
            <option value="member">{MEMBER_GROUP_LABEL.site}</option>
            <option value="manager">{MEMBER_GROUP_LABEL.headquarters}</option>
          </Select>
        </Field>

        {role === "member" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="현장별 메일함 현장" htmlFor="mailSiteId" error={errors.siteId}>
              <Select id="mailSiteId" name="mailSiteId" defaultValue="" className={`w-full ${AUTH_INPUT_CLASS}`}>
                <option value="">선택 안 함</option>
                {mailSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="대외기관 점검 현장" htmlFor="siteId">
              <Select id="siteId" name="siteId" defaultValue="" className={`w-full ${AUTH_INPUT_CLASS}`}>
                <option value="">선택 안 함</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="직위" htmlFor="position">
            <Input id="position" name="position" className={AUTH_INPUT_CLASS} />
          </Field>
          <Field label="부서" htmlFor="department">
            <Input id="department" name="department" className={AUTH_INPUT_CLASS} />
          </Field>
        </div>

        <Button type="submit" className="h-11 w-full bg-[#0a4fa8] hover:bg-[#0b5cc4]" disabled={pending}>
          {pending ? "신청 중…" : "가입 신청"}
        </Button>

        <p className="text-center text-sm text-slate-400">
          이미 계정이 있으신가요?{" "}
          <Link to="/login" className="font-semibold text-white underline underline-offset-4">
            로그인
          </Link>
        </p>
      </Form>
    </AuthShell>
  )
}
