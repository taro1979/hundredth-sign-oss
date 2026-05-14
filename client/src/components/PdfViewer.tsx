import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  url: string;
  onPageCount?: (count: number) => void;
  /** Overlay rendered on top of each page. Receives 0-based page index. */
  overlayContent?: (pageIndex: number) => React.ReactNode;
  className?: string;
  /** Expose current page index (0-based) to parent */
  onCurrentPageChange?: (page: number) => void;
}

interface PageInfo {
  pageNum: number;
  width: number;
  height: number;
}

/**
 * PDF Viewer that renders ALL pages in a scrollable container.
 * Each page has its own canvas + overlay div (same size).
 * Overlay uses percentage-based positioning so zoom doesn't break field placement.
 * Mobile-optimized: auto-fits to container width, touch-friendly controls.
 */
export default function PdfViewer({ url, onPageCount, overlayContent, className = "", onCurrentPageChange }: PdfViewerProps) {
  const { t } = useTranslation();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [autoScale, setAutoScale] = useState(1.0);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef<Set<number>>(new Set());

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    const loadPdf = async () => {
      try {
        const doc = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        onPageCount?.(doc.numPages);

        // Get page dimensions for all pages
        const pageInfos: PageInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          pageInfos.push({ pageNum: i, width: viewport.width, height: viewport.height });
        }
        if (!cancelled) {
          setPages(pageInfos);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (!cancelled) {
          setLoadError(t("pdfViewer.loadError"));
          setIsLoading(false);
        }
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [url, t]);

  // Auto-fit scale based on container width
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return;
    const updateAutoScale = () => {
      const containerWidth = containerRef.current?.clientWidth || 800;
      const padding = 32; // 16px each side
      const availableWidth = containerWidth - padding;
      const maxPageWidth = Math.max(...pages.map(p => p.width));
      if (maxPageWidth > 0) {
        const fitScale = availableWidth / maxPageWidth;
        setAutoScale(Math.min(fitScale, 1.5));
        setScale(Math.min(fitScale, 1.5));
      }
    };
    updateAutoScale();
    const observer = new ResizeObserver(updateAutoScale);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pages]);

  // Render all pages when scale or doc changes
  useEffect(() => {
    if (!pdfDoc || pages.length === 0) return;

    const renderAll = async () => {
      for (const pageInfo of pages) {
        const canvas = canvasRefs.current.get(pageInfo.pageNum);
        if (!canvas) continue;
        if (renderingRef.current.has(pageInfo.pageNum)) continue;

        renderingRef.current.add(pageInfo.pageNum);
        try {
          const page = await pdfDoc.getPage(pageInfo.pageNum);
          const viewport = page.getViewport({ scale });
          const context = canvas.getContext("2d");
          if (!context) continue;

          // Use device pixel ratio for sharp rendering
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = viewport.width * dpr;
          canvas.height = viewport.height * dpr;
          context.scale(dpr, dpr);

          await page.render({ canvasContext: context, viewport }).promise;
        } catch (e: any) {
          if (e?.name !== "RenderingCancelledException") {
            console.error("Render error:", e);
          }
        } finally {
          renderingRef.current.delete(pageInfo.pageNum);
        }
      }
    };
    renderAll();
  }, [pdfDoc, pages, scale]);

  // Track visible page via IntersectionObserver
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = parseInt((entry.target as HTMLElement).dataset.pageNum || "1");
            onCurrentPageChange?.(pageNum - 1);
          }
        }
      },
      { root: containerRef.current, threshold: 0.5 }
    );

    const pageElements = containerRef.current.querySelectorAll("[data-page-num]");
    pageElements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [pages, onCurrentPageChange]);

  const zoomIn = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale(s => Math.max(0.3, +(s - 0.2).toFixed(1)));
  const zoomFit = () => setScale(autoScale);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar - mobile optimized */}
      <div className="flex items-center justify-between bg-gray-100 border-b px-2 sm:px-4 py-2 rounded-t-lg">
        <span className="text-xs sm:text-sm text-gray-600">{t("pdfViewer.pageCount", { count: totalPages })}</span>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.3} className="h-8 w-8 p-0 sm:h-9 sm:w-9">
            <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <button
            onClick={zoomFit}
            className="text-xs sm:text-sm text-gray-600 min-w-[3rem] text-center hover:text-emerald-600 transition-colors"
            title={t("pdfViewer.zoomFit")}
          >
            {Math.round(scale * 100)}%
          </button>
          <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 2.5} className="h-8 w-8 p-0 sm:h-9 sm:w-9">
            <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable container with all pages */}
      <div
        ref={containerRef}
        className="overflow-auto bg-gray-300 flex flex-col items-center gap-2 sm:gap-4 p-2 sm:p-4"
        style={{ maxHeight: "70vh" }}
      >
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{t("pdfViewer.loading")}</p>
              <p className="text-xs text-gray-500 mt-1">{t("pdfViewer.pleaseWait")}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-red-600">{loadError}</p>
              <p className="text-xs text-gray-500 mt-1">{t("pdfViewer.reloadHint")}</p>
            </div>
          </div>
        )}

        {pages.map((pageInfo) => {
          const w = pageInfo.width * scale;
          const h = pageInfo.height * scale;
          return (
            <div
              key={pageInfo.pageNum}
              data-page-num={pageInfo.pageNum}
              className="relative shadow-lg bg-white"
              style={{ width: w, height: h, maxWidth: "100%" }}
            >
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(pageInfo.pageNum, el);
                  else canvasRefs.current.delete(pageInfo.pageNum);
                }}
                className="block"
                style={{ width: w, height: h }}
              />
              {/* Overlay: same size as canvas, percentage-based children */}
              {overlayContent && (
                <div
                  className="absolute top-0 left-0"
                  style={{ width: w, height: h }}
                >
                  {overlayContent(pageInfo.pageNum - 1)}
                </div>
              )}
              {/* Page number label */}
              <div className="absolute bottom-1 right-2 text-xs text-gray-400 bg-white/80 px-1 rounded">
                {pageInfo.pageNum} / {totalPages}
              </div>
            </div>
          );
        })}
        {pages.length === 0 && totalPages > 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}
