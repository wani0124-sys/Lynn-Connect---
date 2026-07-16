import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useFetcher } from "react-router"
import { Loader2, Printer, RotateCcw, Send } from "lucide-react"
import type { InspectionChatMessage } from "~/features/sites/model/inspection-ai-analysis.server"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { Modal } from "~/shared/ui/modal"
import { Textarea } from "~/shared/ui/textarea"

type ActionResult = { ok: true; answer: string } | { error: string }

const EXAMPLE_QUESTIONS = [
  "부적합/시정조치 판정을 받은 현장이 어디야?",
  "이번에 재점검이 필요한 현장과 조치사항을 알려줘",
  "법적으로 문제가 될 수 있는 부분이 있어?",
]

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function printConversation(messages: InspectionChatMessage[]) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return

  const body = messages
    .map((message) => {
      const label = message.role === "user" ? "질문" : "답변"
      return `<div class="msg"><p class="role">${label}</p><p class="content">${escapeHtml(message.content)}</p></div>`
    })
    .join("")

  printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>현장 점검 AI 문답</title>
<style>
  body { font-family: "Malgun Gothic", sans-serif; padding: 32px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .msg { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e5e5; }
  .role { font-weight: bold; font-size: 12px; color: #555; margin: 0 0 4px; }
  .content { white-space: pre-wrap; margin: 0; line-height: 1.6; }
</style>
</head>
<body>
  <h1>현장 점검 AI 문답</h1>
  <p class="meta">출력일시: ${new Date().toLocaleString("ko-KR")} · 참고용 답변이며 최종 법적 판단이 아닙니다.</p>
  ${body}
</body>
</html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

// 전체 현장 점검 기록을 근거로 Claude(Haiku 4.5)에게 자유롭게 질문하고 답을 받는 채팅형 패널.
// 대화는 서버에 저장되지 않고 화면을 벗어나면 사라지는 일회성 정보라, 처음 열 때 안내 팝업을 보여주고
// 인쇄 버튼으로 대화 내용을 남길 수 있게 한다.
export function InspectionAiAnalysisPanel() {
  const fetcher = useFetcher<ActionResult>()
  const [messages, setMessages] = useState<InspectionChatMessage[]>([])
  const [input, setInput] = useState("")
  const [noticeOpen, setNoticeOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pending = fetcher.state !== "idle"
  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, pending])

  useEffect(() => {
    const result = fetcher.data
    if (fetcher.state === "idle" && result && "answer" in result) {
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data])

  function submitConversation(conversation: InspectionChatMessage[]) {
    fetcher.submit({ intent: "inspection.chat", conversation: JSON.stringify(conversation) }, { method: "post" })
  }

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || pending) return
    const nextConversation = [...messages, { role: "user" as const, content: trimmed }]
    setMessages(nextConversation)
    setInput("")
    submitConversation(nextConversation)
  }

  // 답변 실패 시 마지막 질문을 다시 추가하지 않고, 같은 대화 그대로 재요청한다(연속된 user 메시지로 인한 API 오류 방지).
  function retry() {
    if (pending || messages.length === 0) return
    submitConversation(messages)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      ask(input)
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Modal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        title="시작 전 안내"
        footer={<Button onClick={() => setNoticeOpen(false)}>확인했습니다</Button>}
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>이 답변은 AI가 점검 기록을 바탕으로 작성한 참고용 의견이며, 최종 법적 판단이 아닙니다.</li>
          <li>이 대화 내용은 저장되지 않습니다 — 탭을 벗어나거나 새로고침하면 사라집니다.</li>
          <li>대화 내용이 필요하면 상단의 인쇄 버튼으로 출력하거나 PDF로 저장해 두세요.</li>
        </ul>
      </Modal>

      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h3 className="font-semibold">현장 점검 기록 AI 문답</h3>
          <p className="text-sm text-muted-foreground">
            전체 현장의 점검 기록을 바탕으로 질문에 답합니다. 참고용 답변이며 최종 법적 판단은 아닙니다. 대화는 저장되지
            않으니 필요하면 인쇄해 두세요.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => printConversation(messages)}
          disabled={messages.length === 0}
        >
          <Printer className="size-4" aria-hidden />
          인쇄
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">이렇게 물어보세요:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/60"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "max-w-[80%] whitespace-pre-wrap rounded-lg bg-muted px-4 py-2 text-sm text-foreground"
                }
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {pending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              답변을 생성하는 중...
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={retry} disabled={pending}>
              <RotateCcw className="size-3.5" aria-hidden />
              다시 시도
            </Button>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-4">
        <Card className="flex items-end gap-2 border-0 p-2 shadow-none">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="점검 기록에 대해 궁금한 점을 물어보세요 (Shift+Enter로 줄바꿈)"
            className="min-h-10 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button type="button" onClick={() => ask(input)} disabled={pending || !input.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          </Button>
        </Card>
      </div>
    </div>
  )
}
