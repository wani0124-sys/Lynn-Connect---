// 데모 전용 자격증명. .server.ts 접미사로 클라이언트 번들에서 제외된다.
// TODO[security]: 실제 서비스에서는 해시된 비밀번호를 DB에 저장하고 백엔드에서 검증한다.
import { findMemberByEmail } from "~/entities/member/model/member"

const DEMO_PASSWORDS: Record<string, string> = {
  "admin@woomi.dev": "admin1234",
  "manager@woomi.dev": "manager1234",
  "member@woomi.dev": "member1234",
}

// 로그인 화면 안내용 데모 계정. loader에서 클라이언트로 내려보내 화면에 표시한다(데모 목적).
export const DEMO_ACCOUNTS = [
  { email: "admin@woomi.dev", password: "admin1234", role: "관리자" },
  { email: "manager@woomi.dev", password: "manager1234", role: "매니저" },
  { email: "member@woomi.dev", password: "member1234", role: "구성원" },
]

// 성공하면 member id를, 실패하면 null을 반환한다. 정지 계정은 로그인할 수 없다.
export function verifyCredentials(email: string, password: string): string | null {
  const member = findMemberByEmail(email)
  if (!member) return null
  if (member.status === "suspended") return null
  const expected = DEMO_PASSWORDS[member.email.toLowerCase()]
  if (!expected || expected !== password) return null
  return member.id
}
