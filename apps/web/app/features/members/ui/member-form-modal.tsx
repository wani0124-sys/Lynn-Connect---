import { useEffect, useState } from "react"
import {
  CREATABLE_MEMBER_ROLE_OPTIONS,
  MENU_PERMISSION_LABEL,
  type CreatableMemberRole,
  type Member,
  type MenuPermission,
} from "~/entities/member/model/member"
import type { MemberFormValues } from "~/features/members/model/member-form.types"
import type { Site } from "~/entities/site/model/site.types"
import type { SiteMailSite } from "~/entities/site-mail/model/site-mail.types"
import { Button } from "~/shared/ui/button"
import { Checkbox } from "~/shared/ui/checkbox"
import { Field } from "~/shared/ui/field"
import { Input } from "~/shared/ui/input"
import { Modal } from "~/shared/ui/modal"
import { Select } from "~/shared/ui/select"

export interface MemberFormModalProps {
  open: boolean
  onClose: () => void
  sites: Site[]
  mailSites: SiteMailSite[]
  // 수정 중인 계정이 이미 담당 중인 메일함 현장(여러 곳이면 첫 번째를 기본값으로 보여준다).
  editingMemberMailSiteIds?: number[]
  editingMember: Member | null
  pending?: boolean
  error?: string | null
  onSubmit: (values: MemberFormValues) => void
  // 현장 마스터가 여는 경우. 역할·메뉴 권한·마스터 지정은 고정이고, sites/mailSites에는 마스터 본인 현장만 넘어온다.
  siteMasterMode?: boolean
}

const EMPTY_VALUES: MemberFormValues = {
  name: "",
  email: "",
  role: "member",
  position: "",
  department: "",
  menuPermission: "limited",
  siteId: null,
  mailSiteId: null,
  isSiteMaster: false,
}

function toFormValues(member: Member, mailSiteIds: number[]): MemberFormValues {
  return {
    name: member.name,
    email: member.email,
    role: member.role === "member" ? "member" : "manager",
    position: member.position ?? "",
    department: member.department ?? "",
    menuPermission: member.menuPermission,
    siteId: member.siteId,
    mailSiteId: mailSiteIds[0] ?? null,
    isSiteMaster: member.isSiteMaster,
  }
}

export function MemberFormModal({
  open,
  onClose,
  sites,
  mailSites,
  editingMemberMailSiteIds = [],
  editingMember,
  pending,
  error,
  onSubmit,
  siteMasterMode = false,
}: MemberFormModalProps) {
  const [values, setValues] = useState<MemberFormValues>(EMPTY_VALUES)
  const isEdit = editingMember !== null

  useEffect(() => {
    if (!open) return
    // 현장 마스터는 고를 수 있는 현장이 본인 현장뿐이라 신규 생성 시 미리 채워 둔다.
    const initial = siteMasterMode
      ? { ...EMPTY_VALUES, siteId: sites[0]?.id ?? null, mailSiteId: mailSites[0]?.id ?? null }
      : EMPTY_VALUES
    setValues(editingMember ? toFormValues(editingMember, editingMemberMailSiteIds) : initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달을 열 때 한 번만 초기화한다.
  }, [open, editingMember])

  function updateRole(role: CreatableMemberRole) {
    setValues((prev) => ({
      ...prev,
      role,
      menuPermission: role === "manager" ? "all" : "limited",
      siteId: role === "manager" ? null : prev.siteId,
      mailSiteId: role === "manager" ? null : prev.mailSiteId,
      isSiteMaster: role === "manager" ? false : prev.isSiteMaster,
    }))
  }

  const canSubmit =
    values.name.trim() !== "" &&
    values.email.trim() !== "" &&
    (values.role === "manager" || values.siteId !== null || values.mailSiteId !== null || (siteMasterMode && isEdit))

  function submit() {
    if (!canSubmit) return
    onSubmit({ ...values, name: values.name.trim(), email: values.email.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "계정 수정" : "계정 생성"}
      description={isEdit ? "구성원 계정 정보를 수정합니다" : "본사관리자 또는 현장관리자 계정을 생성합니다"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || pending}>
            {pending ? "처리 중…" : isEdit ? "저장" : "생성"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

        {!isEdit ? (
          <p className="rounded-md bg-info/10 px-3 py-2 text-xs text-info">
            이메일이 로그인 아이디가 되며, 초기 비밀번호는 <span className="font-mono font-medium">Woomilynn</span>으로
            고정 발급됩니다. 최초 로그인 후 본인이 반드시 비밀번호를 변경해야 합니다.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="이름" htmlFor="member-name" required>
            <Input
              id="member-name"
              value={values.name}
              onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="예: 정준영"
            />
          </Field>
          <Field label="이메일" htmlFor="member-email" required>
            <Input
              id="member-email"
              type="email"
              value={values.email}
              onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="예: name@wm.co.kr"
              disabled={isEdit}
            />
          </Field>
        </div>

        {siteMasterMode ? null : (
          <Field label="역할" htmlFor="member-role" required>
            <Select
              id="member-role"
              value={values.role}
              onChange={(e) => updateRole(e.target.value as CreatableMemberRole)}
              className="w-full"
            >
              {CREATABLE_MEMBER_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="직위 (선택)" htmlFor="member-position">
            <Input
              id="member-position"
              value={values.position}
              onChange={(e) => setValues((prev) => ({ ...prev, position: e.target.value }))}
              placeholder="예: 과장"
            />
          </Field>
          <Field label="부서 (선택)" htmlFor="member-department">
            <Input
              id="member-department"
              value={values.department}
              onChange={(e) => setValues((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="예: 건축기획팀"
            />
          </Field>
        </div>

        {siteMasterMode && isEdit ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            소속 현장 변경은 본사관리자에게 요청하세요.
          </p>
        ) : values.role === "member" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              소속 현장 <span className="text-danger">*</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="현장별 메일함" htmlFor="member-mail-site">
                <Select
                  id="member-mail-site"
                  value={values.mailSiteId ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, mailSiteId: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full"
                >
                  <option value="">선택 안 함</option>
                  {mailSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="대외기관 점검" htmlFor="member-site">
                <Select
                  id="member-site"
                  value={values.siteId ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, siteId: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full"
                >
                  <option value="">선택 안 함</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              {siteMasterMode
                ? "현장 마스터는 본인이 맡은 현장에만 계정을 만들 수 있습니다."
                : "두 메뉴의 현장 목록은 따로 관리됩니다. 하나 이상 고르세요. 한 현장에 담당자를 여러 명 둘 수 있습니다."}
            </p>
            {siteMasterMode ? null : (
              <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                <Checkbox
                  className="mt-0.5"
                  checked={values.isSiteMaster}
                  onChange={(e) => setValues((prev) => ({ ...prev, isSiteMaster: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium">현장 마스터로 지정</span>
                  <span className="block text-xs text-muted-foreground">
                    지정하면 이 계정이 같은 현장의 현장관리자 계정을 직접 생성·수정·삭제할 수 있습니다.
                  </span>
                </span>
              </label>
            )}
          </div>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            본사관리자는 모든 현장을 관리합니다.
          </p>
        )}

        {siteMasterMode ? null : (
          <Field label="메뉴 권한" htmlFor="member-menu-permission" required>
            <Select
              id="member-menu-permission"
              value={values.menuPermission}
              onChange={(e) => setValues((prev) => ({ ...prev, menuPermission: e.target.value as MenuPermission }))}
              className="w-full"
            >
              {(Object.entries(MENU_PERMISSION_LABEL) as [MenuPermission, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}
