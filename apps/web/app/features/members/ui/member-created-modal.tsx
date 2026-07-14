import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "~/shared/ui/button"
import { Modal } from "~/shared/ui/modal"
import { TBody, TD, TH, THead, TR, Table } from "~/shared/ui/table"

export interface CreatedAccount {
  name: string
  email: string
  tempPassword: string
}

export interface MemberCreatedModalProps {
  open: boolean
  onClose: () => void
  accounts: CreatedAccount[]
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="복사"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </Button>
  )
}

export function MemberCreatedModal({ open, onClose, accounts }: MemberCreatedModalProps) {
  const summary = accounts.map((a) => `${a.name} / ${a.email} / ${a.tempPassword}`).join("\n")

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="계정이 생성되었습니다"
      description="임시 비밀번호는 지금만 확인할 수 있습니다. 담당자에게 안전하게 전달하세요. 최초 로그인 시 본인이 비밀번호를 변경해야 합니다."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(summary)
            }}
          >
            전체 복사
          </Button>
          <Button type="button" onClick={onClose}>
            확인
          </Button>
        </>
      }
    >
      <Table>
        <THead>
          <TR>
            <TH>이름</TH>
            <TH>이메일</TH>
            <TH>임시 비밀번호</TH>
            <TH className="text-right">복사</TH>
          </TR>
        </THead>
        <TBody>
          {accounts.map((account) => (
            <TR key={account.email}>
              <TD className="font-medium">{account.name}</TD>
              <TD className="text-muted-foreground">{account.email}</TD>
              <TD className="font-mono">{account.tempPassword}</TD>
              <TD className="text-right">
                <CopyButton value={`${account.name} / ${account.email} / ${account.tempPassword}`} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Modal>
  )
}
