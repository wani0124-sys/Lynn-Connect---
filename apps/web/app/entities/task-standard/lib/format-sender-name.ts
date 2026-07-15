const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// EML "From" 헤더는 이름이 없으면 `"이름" <email>` 원문 전체가 senderName에 들어올 수 있다.
// 화면에는 발신자 메일주소를 노출하지 않도록 이름만 남긴다.
export function formatSenderName(raw: string | null): string | null {
  if (!raw) return null
  const withoutAngleEmail = raw.replace(/<[^<>]*>/g, "").replace(/["']/g, "").trim()
  if (!withoutAngleEmail || EMAIL_PATTERN.test(withoutAngleEmail)) return null
  return withoutAngleEmail
}
