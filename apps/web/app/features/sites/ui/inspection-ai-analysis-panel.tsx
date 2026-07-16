import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useFetcher } from "react-router"
import { Loader2, Send } from "lucide-react"
import type { InspectionChatMessage } from "~/features/sites/model/inspection-ai-analysis.server"
import { Button } from "~/shared/ui/button"
import { Card } from "~/shared/ui/card"
import { Textarea } from "~/shared/ui/textarea"

type ActionResult = { ok: true; answer: string } | { error: string }

const EXAMPLE_QUESTIONS = [
  "부적합/시정조치 판정을 받은 현장이 어디야?",
  "이번에 재점검이 필요한 현장과 조치사항을 알려줘",
  "법적으로 문제가 될 수 있는 부분이 있어?",
]

// 전체 현장 점검 기록을 근거로 Claude(Haiku 4.5)에게 자유롭게 질문하고 답을 받는 채팅형 패널.
// 매 질문마다 서버가 최신 점검 기록 + 대화 이력을 함께 보내 멀티턴 대화를 지원한다.
export function InspectionAiAnalysisPanel() {
  const fetcher = useFetcher<ActionResult>()
  const [messages, setMessages] = useState<InspectionChatMessage[]>([])
  const [input, setInput] = useState("")
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

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || pending) return
    const nextConversation = [...messages, { role: "user" as const, content: trimmed }]
    setMessages(nextConversation)
    setInput("")
    fetcher.submit({ intent: "inspection.chat", conversation: JSON.stringify(nextConversation) }, { method: "post" })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      ask(input)
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h3 className="font-semibold">현장 점검 기록 AI 문답</h3>
        <p className="text-sm text-muted-foreground">
          전체 현장의 점검 기록을 바탕으로 질문에 답합니다. 참고용 답변이며 최종 법적 판단은 아닙니다.
        </p>
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

        {error ? <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
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
