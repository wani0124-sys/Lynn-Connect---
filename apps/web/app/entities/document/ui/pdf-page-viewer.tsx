import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "~/shared/ui/button"

// react-pdf 컴포넌트를 쓰는 파일 안에서 워커를 설정해야 한다(다른 파일에서 설정하면 실행 순서 때문에
// 기본값으로 덮어써질 수 있음 - react-pdf 문서 권장 사항). CDN을 써서 별도 Vite 번들 설정 없이 동작한다.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
}

export function PdfPageViewer({ url, title }: { url: string; title: string }) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageWidth, setPageWidth] = useState<number>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPageNumber(1)
  }, [url])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setPageWidth(Math.min(width - 32, 900))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function goToPrevPage() {
    setPageNumber((p) => Math.max(1, p - 1))
  }

  function goToNextPage() {
    setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p))
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        className="flex w-full items-start justify-center overflow-auto bg-muted/30 p-4"
        style={{ maxHeight: "85vh" }}
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          options={PDF_OPTIONS}
          loading={<p className="py-20 text-center text-sm text-muted-foreground">문서를 불러오는 중…</p>}
          error={<p className="py-20 text-center text-sm text-danger">PDF를 불러오지 못했습니다.</p>}
        >
          <Page
            key={pageNumber}
            pageNumber={pageNumber}
            width={pageWidth}
            className="inline-block border border-border shadow-sm"
            aria-label={`${title} ${pageNumber}페이지`}
          />
        </Document>
      </div>

      {numPages ? (
        <div className="flex items-center gap-3 border-t border-border py-3">
          <Button type="button" variant="outline" size="icon" disabled={pageNumber <= 1} onClick={goToPrevPage} aria-label="이전 페이지">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {pageNumber} / {numPages} 페이지
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={pageNumber >= numPages}
            onClick={goToNextPage}
            aria-label="다음 페이지"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
