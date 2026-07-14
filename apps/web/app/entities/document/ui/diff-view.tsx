import type { DiffChunk } from "~/entities/document/model/document.types"
import { cn } from "~/shared/lib/cn"

const UNCHANGED_CONTEXT_LINES = 3

function splitLines(value: string): string[] {
  const lines = value.split("\n")
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  return lines
}

function DiffLine({ type, text }: { type: DiffChunk["type"]; text: string }) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words px-3 py-0.5",
        type === "added" && "bg-success/10 text-success",
        type === "removed" && "bg-danger/10 text-danger line-through",
      )}
    >
      <span className="mr-2 select-none text-muted-foreground">{type === "added" ? "+" : type === "removed" ? "-" : " "}</span>
      {text || " "}
    </div>
  )
}

export function DiffView({ diff }: { diff: DiffChunk[] }) {
  if (diff.every((chunk) => chunk.type === "unchanged")) {
    return <p className="p-3 text-sm text-muted-foreground">이전 리비전과 텍스트 차이가 없습니다.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card py-1 font-mono text-xs">
      {diff.map((chunk, chunkIndex) => {
        const lines = splitLines(chunk.value)

        if (chunk.type === "unchanged" && lines.length > UNCHANGED_CONTEXT_LINES * 2) {
          const head = lines.slice(0, UNCHANGED_CONTEXT_LINES)
          const tail = lines.slice(-UNCHANGED_CONTEXT_LINES)
          const hiddenCount = lines.length - head.length - tail.length
          return (
            <div key={chunkIndex}>
              {head.map((line, i) => (
                <DiffLine key={`h-${i}`} type="unchanged" text={line} />
              ))}
              <div className="px-3 py-1 text-muted-foreground">… 동일한 {hiddenCount}줄 생략 …</div>
              {tail.map((line, i) => (
                <DiffLine key={`t-${i}`} type="unchanged" text={line} />
              ))}
            </div>
          )
        }

        return (
          <div key={chunkIndex}>
            {lines.map((line, i) => (
              <DiffLine key={i} type={chunk.type} text={line} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
