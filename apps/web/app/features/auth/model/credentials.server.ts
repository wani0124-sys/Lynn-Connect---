// .server.ts 접미사로 클라이언트 번들에서 제외된다.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { getMemberCredentialsByEmail, setMemberPasswordHash } from "~/features/members/model/members.repository.server"

const SCRYPT_KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex")
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":")
  if (!salt || !hashHex) return false
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  const storedHash = Buffer.from(hashHex, "hex")
  if (hash.length !== storedHash.length) return false
  return timingSafeEqual(hash, storedHash)
}

// 성공하면 member id를, 실패하면 null을 반환한다. 정지 계정은 로그인할 수 없다.
export async function verifyCredentials(email: string, password: string): Promise<string | null> {
  const credentials = await getMemberCredentialsByEmail(email)
  if (!credentials) return null
  if (credentials.status === "suspended") return null
  if (!verifyPassword(password, credentials.passwordHash)) return null
  return credentials.id
}

// 멤버 관리에서 기존 계정의 비밀번호를 재발급/변경할 때 사용한다(계정 생성 시에는 password_hash를
// insert에 직접 포함하므로 이 함수를 쓰지 않는다).
export async function setPassword(email: string, password: string): Promise<void> {
  await setMemberPasswordHash(email, hashPassword(password))
}

// 계정 생성/일괄 생성 시 이메일을 아이디로, 이 값을 초기 비밀번호로 강제 부여한다.
// 최초 로그인 후 본인이 반드시 변경해야 한다(mustChangePassword).
export const DEFAULT_TEMP_PASSWORD = "Woomilynn"

export function generateTempPassword(): string {
  return DEFAULT_TEMP_PASSWORD
}
