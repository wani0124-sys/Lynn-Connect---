import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import "./app.css"
import { ErrorState } from "~/shared/ui/error-state"

export function meta() {
  return [
    { title: "Lynn-Connect 대시보드" },
    { name: "description", content: "Lynn-Connect 관리자 대시보드" },
  ]
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <Links />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  let title = "문제가 발생했습니다"
  let description = "예상치 못한 오류로 화면을 표시하지 못했습니다. 잠시 후 다시 시도해 주세요."

  if (isRouteErrorResponse(error)) {
    title = `${error.status} 오류`
    description = error.statusText || description
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <ErrorState title={title} description={description} />
      </div>
    </div>
  )
}
