import type { ReactNode } from "react"
import { Waypoints } from "lucide-react"

// 로그인·회원가입 공통 틀. 배경 영상 위에 왼쪽 파란 소개 영역과 오른쪽 어두운 입력 영역을 둔다.
// 오른쪽 영역은 어두운 배경이라 공통 Field 라벨이 쓰는 글자색 변수를 밝은 색으로 바꿔 둔다.
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* 배경 영상: 소리 없이 반복 재생. 파일이 없거나 움직임 줄이기 설정이면 남색 배경만 보인다. */}
      <video
        className="pointer-events-none absolute inset-0 size-full object-cover motion-reduce:hidden"
        src="/videos/login-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/70" aria-hidden />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2">
        <section className="hidden flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0a5bc4] to-[#0a3d8f] px-10 py-14 text-center text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full border-2 border-white">
              <Waypoints className="size-7" aria-hidden />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Lynn-Connect<span className="text-orange-400">.</span>
            </h1>
          </div>
          <p className="text-sm text-white/80">업무기준 · 현장 메일함 · 대외기관 점검</p>
          <div className="mt-2 h-px w-48 bg-white/30" aria-hidden />
          <p className="max-w-xs text-sm leading-relaxed text-white/70">
            본사와 현장이 함께 쓰는 업무 공간입니다. 계정이 없으면 회원가입을 신청하고 관리자 승인을 받아 주세요.
          </p>
        </section>

        <section className="bg-[#161b26] px-6 py-10 text-slate-100 [--color-foreground:#f1f5f9] [--color-muted-foreground:#94a3b8] sm:px-12">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <div className="flex size-8 items-center justify-center rounded-full border-2 border-white">
              <Waypoints className="size-4" aria-hidden />
            </div>
            <span className="text-lg font-bold">Lynn-Connect</span>
          </div>
          <h2 className="mb-6 text-lg font-bold">{title}</h2>
          {children}
        </section>
      </div>
    </div>
  )
}

// 어두운 입력 영역에서 쓰는 입력칸 모양(밝은 회색 칸 + 진한 글자).
export const AUTH_INPUT_CLASS = "h-11 rounded-lg border-transparent bg-slate-100 text-slate-900 placeholder:text-slate-400"
