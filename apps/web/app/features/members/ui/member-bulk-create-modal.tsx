import { useEffect, useState } from "react"
import { CREATABLE_MEMBER_ROLE_OPTIONS, type CreatableMemberRole } from "~/entities/member/model/member"
import type { Site } from "~/entities/site/model/site.types"
import { Button } from "~/shared/ui/button"
import { Field } from "~/shared/ui/field"
import { Modal } from "~/shared/ui/modal"
import { Select } from "~/shared/ui/select"
import { Textarea } from "~/shared/ui/textarea"

export interface BulkCreateRow {
  name: string
  email: string
}

export interface MemberBulkCreateModalProps {
  open: boolean
  onClose: () => void
  sites: Site[]
  pending?: boolean
  error?: string | null
  onSubmit: (rows: BulkCreateRow[], role: CreatableMemberRole, siteId: number | null) => void
}

function parseRows(raw: string): BulkCreateRow[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name, email] = line.split(",").map((part) => part.trim())
      return { name: name ?? "", email: email ?? "" }
    })
    .filter((row) => row.name !== "" && row.email !== "")
}

export function MemberBulkCreateModal({ open, onClose, sites, pending, error, onSubmit }: MemberBulkCreateModalProps) {
  const [role, setRole] = useState<CreatableMemberRole>("member")
  const [siteId, setSiteId] = useState<number | null>(null)
  const [raw, setRaw] = useState("")

  useEffect(() => {
    if (!open) return
    setRole("member")
    setSiteId(null)
    setRaw("")
  }, [open])

  const rows = parseRows(raw)
  const canSubmit = rows.length > 0 && (role === "manager" || siteId !== null)

  function submit() {
    if (!canSubmit) return
    onSubmit(rows, role, role === "manager" ? null : siteId)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="계정 일괄 생성"
      description="같은 역할·현장으로 여러 계정을 한 번에 생성합니다"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || pending}>
            {pending ? "생성 중…" : rows.length > 0 ? `${rows.length}명 생성` : "생성"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        <p className="rounded-md bg-info/10 px-3 py-2 text-xs text-info">
          이메일이 로그인 아이디가 되며, 초기 비밀번호는 <span className="font-mono font-medium">Woomilynn</span>으로 모든
          계정에 동일하게 고정 발급됩니다. 최초 로그인 후 본인이 반드시 비밀번호를 변경해야 합니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="역할" htmlFor="bulk-role" required>
            <Select
              id="bulk-role"
              value={role}
              onChange={(e) => {
                const next = e.target.value as CreatableMemberRole
                setRole(next)
                if (next === "manager") setSiteId(null)
              }}
              className="w-full"
            >
              {CREATABLE_MEMBER_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          {role === "member" ? (
            <Field label="소속 현장" htmlFor="bulk-site" required>
              <Select
                id="bulk-site"
                value={siteId ?? ""}
                onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : null)}
                className="w-full"
              >
                <option value="">현장을 선택하세요</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <Field
          label="계정 목록"
          htmlFor="bulk-rows"
          required
          hint="한 줄에 '이름,이메일' 형식으로 입력하세요. 예: 정준영,jungjy@wm.co.kr"
        >
          <Textarea
            id="bulk-rows"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"정준영,jungjy@wm.co.kr\n정재훈,enghoon@wm.co.kr"}
            className="min-h-40 font-mono"
          />
        </Field>

        <p className="text-xs text-muted-foreground">{rows.length}개의 유효한 행이 인식되었습니다.</p>
      </div>
    </Modal>
  )
}
