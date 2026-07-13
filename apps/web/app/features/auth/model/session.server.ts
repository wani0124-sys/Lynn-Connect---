import { createCookieSessionStorage, redirect } from "react-router"
import { findMemberById, isHeadquarters, type Member } from "~/entities/member/model/member"

// TODO[security]: 데모용 기본 시크릿. 운영에서는 반드시 SESSION_SECRET 환경변수를 설정한다.
const sessionSecret = process.env.SESSION_SECRET ?? "dev-insecure-session-secret-change-me"

const storage = createCookieSessionStorage({
  cookie: {
    name: "woomi_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  },
})

const USER_ID_KEY = "userId"

function getSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"))
}

// open redirect 방지: 앱 내부 경로만 허용한다.
export function safeRedirect(to: unknown, fallback = "/"): string {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) return fallback
  return to
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession()
  session.set(USER_ID_KEY, userId)
  return redirect(safeRedirect(redirectTo), {
    headers: { "Set-Cookie": await storage.commitSession(session) },
  })
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request)
  const userId = session.get(USER_ID_KEY)
  return typeof userId === "string" ? userId : null
}

export async function getUser(request: Request): Promise<Member | null> {
  const userId = await getUserId(request)
  if (!userId) return null
  return findMemberById(userId) ?? null
}

// 인증이 필요한 route loader에서 호출한다. 미인증이면 로그인 화면으로 redirect(throw)한다.
export async function requireUser(request: Request): Promise<Member> {
  const user = await getUser(request)
  if (!user) {
    const url = new URL(request.url)
    const params = new URLSearchParams([["redirectTo", url.pathname + url.search]])
    throw redirect(`/login?${params.toString()}`)
  }
  return user
}

// 본사 권한이 필요한 route loader/action에서 호출한다. 현장 권한이면 /forbidden으로 redirect(throw)한다.
export async function requireHeadquarters(request: Request): Promise<Member> {
  const user = await requireUser(request)
  if (!isHeadquarters(user.role)) {
    throw redirect("/forbidden")
  }
  return user
}

export async function logout(request: Request) {
  const session = await getSession(request)
  return redirect("/login", {
    headers: { "Set-Cookie": await storage.destroySession(session) },
  })
}
