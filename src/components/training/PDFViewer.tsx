"use client"

import { useState, useCallback, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
} from "lucide-react"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  url: string
  onPageChange?: (currentPage: number, totalPages: number) => void
  onAllPagesViewed?: () => void
  minTimePerPage?: number // Her sayfa icin minimum sure (saniye)
}

export function PDFViewer({
  url,
  onPageChange,
  onAllPagesViewed,
  minTimePerPage = 5,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set([1]))
  const [pageTimer, setPageTimer] = useState<number>(0)
  const [canProceed, setCanProceed] = useState<boolean>(minTimePerPage === 0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sayfa zamanlayici
  useEffect(() => {
    if (minTimePerPage > 0) {
      setPageTimer(0)
      setCanProceed(viewedPages.has(pageNumber))

      const interval = setInterval(() => {
        setPageTimer((prev) => {
          const newTime = prev + 1
          if (newTime >= minTimePerPage && !viewedPages.has(pageNumber)) {
            setViewedPages((prevViewed) => {
              const newViewed = new Set(prevViewed)
              newViewed.add(pageNumber)
              return newViewed
            })
            setCanProceed(true)
          }
          return newTime
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [pageNumber, minTimePerPage])

  // Tum sayfalar goruntulendi mi kontrol et
  useEffect(() => {
    if (numPages > 0 && viewedPages.size === numPages && onAllPagesViewed) {
      onAllPagesViewed()
    }
  }, [viewedPages, numPages, onAllPagesViewed])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      setLoading(false)
      onPageChange?.(1, numPages)
    },
    [onPageChange]
  )

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("PDF yukleme hatasi:", error)
    setError("PDF dosyasi yuklenemedi")
    setLoading(false)
  }, [])

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1
      setPageNumber(newPage)
      onPageChange?.(newPage, numPages)
    }
  }

  const goToNextPage = () => {
    if (pageNumber < numPages && canProceed) {
      const newPage = pageNumber + 1
      setPageNumber(newPage)
      onPageChange?.(newPage, numPages)
    }
  }

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2.5))
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5))

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Ilerleme yuzdesi
  const progressPercent = numPages > 0 ? Math.round((viewedPages.size / numPages) * 100) : 0

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <FileText className="h-16 w-16 mb-4 text-red-400" />
        <p className="text-red-500">{error}</p>
        <p className="text-sm mt-2">Lutfen sayfayi yenileyin veya yoneticiyle iletisime gecin.</p>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "border rounded-lg bg-muted/30"
      }`}
    >
      {/* Kontroller */}
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[100px] text-center">
            Sayfa {pageNumber} / {numPages || "..."}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages || !canProceed}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Sayfa zamanlayici */}
          {minTimePerPage > 0 && !viewedPages.has(pageNumber) && (
            <span className="text-xs text-muted-foreground">
              {Math.max(0, minTimePerPage - pageTimer)}s kaldi
            </span>
          )}

          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* PDF Icerigi */}
      <div
        className={`flex-1 overflow-auto flex justify-center p-4 ${
          isFullscreen ? "h-[calc(100vh-120px)]" : "min-h-[500px] max-h-[70vh]"
        }`}
      >
        {loading && (
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">PDF yukleniyor...</div>
          </div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Ilerleme */}
      <div className="p-3 border-t bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Goruntulenen: {viewedPages.size} / {numPages || "..."} sayfa
          </span>
          <span className="text-sm font-medium">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {progressPercent < 100 && (
          <p className="text-xs text-muted-foreground mt-2">
            Egitimi tamamlamak icin tum sayfalari goruntulemeniz gerekmektedir.
          </p>
        )}
      </div>
    </div>
  )
}
