import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "~/shared/ui/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/shared/ui/card"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Textarea } from "~/shared/ui/textarea"
import { Checkbox } from "~/shared/ui/checkbox"
import { Button } from "~/shared/ui/button"
import { ConfirmPanel } from "~/shared/ui/confirm-panel"

const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요."),
  email: z.string().min(1, "이메일을 입력하세요.").email("올바른 이메일 형식이 아닙니다."),
  bio: z.string().max(200, "200자 이내로 입력하세요.").optional().or(z.literal("")),
})

type ProfileInput = z.infer<typeof profileSchema>

export default function SettingsRoute() {
  return (
    <div className="space-y-6">
      <PageHeader title="설정" description="프로필, 알림, 계정 관련 설정을 관리합니다." />
      <ProfileSection />
      <NotificationSection />
      <DangerZoneSection />
    </div>
  )
}

function ProfileSection() {
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "김우미", email: "woomi@example.com", bio: "" },
  })

  // 실제로는 API 저장 후 서버 검증 오류를 setError로 각 Field에 매핑한다.
  const onSubmit = handleSubmit(async () => {
    setPending(true)
    setSaved(false)
    await new Promise((r) => setTimeout(r, 600))
    setPending(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>프로필</CardTitle>
        <CardDescription>이름과 연락처 정보를 관리합니다.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <Field label="이름" htmlFor="profile-name" required error={errors.name?.message}>
            <Input id="profile-name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="이메일" htmlFor="profile-email" required error={errors.email?.message}>
            <Input
              id="profile-email"
              type="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>
          <Field
            label="소개"
            htmlFor="profile-bio"
            hint="200자 이내로 입력하세요."
            error={errors.bio?.message}
          >
            <Textarea id="profile-bio" aria-invalid={!!errors.bio} {...register("bio")} />
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
          {saved ? (
            <span className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              저장되었습니다.
            </span>
          ) : null}
        </CardFooter>
      </form>
    </Card>
  )
}

interface NotificationSettings {
  email: boolean
  weekly: boolean
  push: boolean
}

function NotificationSection() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    weekly: false,
    push: true,
  })
  const [saved, setSaved] = useState(false)

  const toggle = (key: keyof NotificationSettings) => (event: { target: { checked: boolean } }) => {
    setSettings((prev) => ({ ...prev, [key]: event.target.checked }))
    setSaved(false)
  }

  const onSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>알림</CardTitle>
        <CardDescription>받을 알림 종류를 선택합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="notif-email" className="text-sm font-medium text-foreground">
            이메일 알림 받기
          </label>
          <Checkbox id="notif-email" checked={settings.email} onChange={toggle("email")} />
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="notif-weekly" className="text-sm font-medium text-foreground">
            주간 요약 받기
          </label>
          <Checkbox id="notif-weekly" checked={settings.weekly} onChange={toggle("weekly")} />
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="notif-push" className="text-sm font-medium text-foreground">
            중요 이벤트 푸시
          </label>
          <Checkbox id="notif-push" checked={settings.push} onChange={toggle("push")} />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={onSave}>
          저장
        </Button>
        {saved ? (
          <span className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            저장되었습니다.
          </span>
        ) : null}
      </CardFooter>
    </Card>
  )
}

function DangerZoneSection() {
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState(false)

  return (
    <Card className="border-danger/30">
      <CardHeader>
        <CardTitle>위험 구역</CardTitle>
        <CardDescription>
          계정을 초기화하면 모든 설정과 데이터가 삭제되며 되돌릴 수 없습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {confirming ? (
          <ConfirmPanel
            title="계정을 초기화할까요?"
            description="모든 설정과 데이터가 삭제되며 되돌릴 수 없습니다."
            confirmLabel="계정 초기화"
            onConfirm={() => {
              setConfirming(false)
              setNotice(true)
            }}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            계정 초기화
          </Button>
        )}
        {notice ? (
          <p className="text-sm text-muted-foreground">
            스캐폴드에서는 초기화가 실행되지 않습니다. 실제로는 계정 삭제 API를 호출하세요.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
