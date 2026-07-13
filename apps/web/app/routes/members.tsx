import { useLoaderData, type LoaderFunctionArgs } from "react-router"
import { UserPlus } from "lucide-react"
import { requireUser } from "~/features/auth/model/session.server"
import {
  MEMBER_ROLE_LABEL,
  MEMBER_ROLE_TONE,
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_TONE,
  seedMembers,
} from "~/entities/member/model/member"
import { Badge } from "~/shared/ui/badge"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { PageHeader } from "~/shared/ui/page-header"
import { Table, TBody, TD, TH, THead, TR } from "~/shared/ui/table"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  return { members: seedMembers, currentUserId: user.id }
}

export default function MembersRoute() {
  const { members, currentUserId } = useLoaderData<typeof loader>()

  return (
    <div className="space-y-6">
      <PageHeader
        title="구성원"
        description="팀 구성원과 로그인 계정을 관리합니다."
        actions={
          <Button>
            <UserPlus aria-hidden />
            구성원 초대
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>이름</TH>
              <TH>이메일</TH>
              <TH>역할</TH>
              <TH>상태</TH>
              <TH className="text-right">관리</TH>
            </TR>
          </THead>
          <TBody>
            {members.map((member) => (
              <TR key={member.id}>
                <TD className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {member.name}
                    {member.id === currentUserId ? <Badge tone="primary">나</Badge> : null}
                  </span>
                </TD>
                <TD className="text-muted-foreground">{member.email}</TD>
                <TD>
                  <Badge tone={MEMBER_ROLE_TONE[member.role]}>{MEMBER_ROLE_LABEL[member.role]}</Badge>
                </TD>
                <TD>
                  <Badge tone={MEMBER_STATUS_TONE[member.status]}>
                    {MEMBER_STATUS_LABEL[member.status]}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    관리
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>로그인 계정 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            위 목록의 계정으로 로그인할 수 있습니다. 실제 서비스에서는 이 화면에서 계정 추가, 비밀번호
            재설정, 역할·권한 변경, 정지/해제를 처리합니다.
          </p>
          <p>
            데모 관리자 계정: <span className="font-mono text-foreground">admin@woomi.dev</span> /{" "}
            <span className="font-mono text-foreground">admin1234</span>
          </p>
          <p>
            지금은 데모 시드(<span className="font-mono">entities/member</span>)를 사용합니다. 실제로는
            백엔드 API와 DB로 교체하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
