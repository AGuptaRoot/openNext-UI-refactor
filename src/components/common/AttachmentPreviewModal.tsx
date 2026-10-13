import React, { useEffect, useRef, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Plugin hosts often fail to serve Vite's emitted `pdf.worker.*.mjs`
 * (404 or wrong MIME), which breaks Worker + dynamic import("…mjs").
 * Preload WorkerMessageHandler onto globalThis so pdf.js fake-worker
 * path works without fetching a separate .mjs asset.
 */
let pdfWorkerReady: Promise<void> | null = null;

function ensurePdfWorker(): Promise<void> {
  if (!pdfWorkerReady) {
    pdfWorkerReady = (async () => {
      // Bundled as a JS chunk (not a raw .mjs asset), so plugin hosts can load it.
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs');
      (
        globalThis as typeof globalThis & {
          pdfjsWorker?: { WorkerMessageHandler: unknown };
        }
      ).pdfjsWorker = workerMod;
      // Required by pdf.js API; ignored when pdfjsWorker is already on globalThis.
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';
      }
    })();
  }
  return pdfWorkerReady;
}

export type PreviewKind = 'image' | 'pdf' | null;

export function resolvePreviewKind(mimeType?: string, fileName?: string): PreviewKind {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();

  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)$/i.test(name)) {
    return 'image';
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  return null;
}

/** Fetch file with session cookies and trigger a browser download. */
export async function downloadAttachment(url: string, fileName = 'download'): Promise<void> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.clone().json();
      detail = payload?.error || payload?.message || '';
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(
      detail
        ? `Download failed (${response.status}): ${detail}`
        : `Download failed (${response.status})`
    );
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName || 'download';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

interface AttachmentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  name?: string;
  mimeType?: string;
}

/**
 * Image preview via blob URL.
 * PDF preview via PDF.js canvas (Chrome blocks/blank iframe+blob PDF viewers).
 */
export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  open,
  onClose,
  url,
  name,
  mimeType,
}) => {
  const kind = resolvePreviewKind(mimeType, name);
  const title = name || 'Attachment preview';
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !url) {
      setBlobUrl('');
      setError('');
      setLoading(false);
      setPageCount(0);
      return;
    }

    let cancelled = false;
    let createdUrl = '';
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const load = async () => {
      setLoading(true);
      setError('');
      setBlobUrl('');
      setPageCount(0);
      if (pdfContainerRef.current) pdfContainerRef.current.innerHTML = '';

      try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to load file (${response.status})`);
        }
        const bytes = await response.arrayBuffer();
        if (cancelled) return;

        if (kind === 'image') {
          const typed = new Blob([bytes], { type: mimeType || 'image/jpeg' });
          createdUrl = URL.createObjectURL(typed);
          if (!cancelled) setBlobUrl(createdUrl);
          return;
        }

        if (kind === 'pdf') {
          // Detect HTML/JSON error bodies mistakenly returned as PDF
          const head = new TextDecoder().decode(bytes.slice(0, 8));
          if (!head.startsWith('%PDF') && !head.includes('%PDF')) {
            throw new Error('File is not a valid PDF');
          }

          await ensurePdfWorker();
          if (cancelled) return;

          pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
          if (cancelled) return;

          const total = pdfDoc.numPages;
          setPageCount(total);
          const container = pdfContainerRef.current;
          if (!container) return;
          container.innerHTML = '';

          const maxPages = Math.min(total, 25);
          for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
            const page = await pdfDoc.getPage(pageNum);
            if (cancelled) return;

            const unscaled = page.getViewport({ scale: 1 });
            const width = Math.max(container.clientWidth || 800, 320);
            const scale = Math.min(width / unscaled.width, 1.6);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.className = 'mb-3 w-full max-w-full rounded-lg border border-zinc-300 bg-white shadow-sm';
            canvas.style.height = 'auto';

            const context = canvas.getContext('2d');
            if (!context) continue;
            await page.render({ canvasContext: context, viewport }).promise;
            container.appendChild(canvas);
          }

          if (total > maxPages) {
            const note = document.createElement('div');
            note.className = 'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-xs text-zinc-500';
            note.textContent = `Showing first ${maxPages} of ${total} pages. Download to view the full PDF.`;
            container.appendChild(note);
          }
          return;
        }

        throw new Error('Preview not supported for this file type');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      if (pdfDoc) {
        void pdfDoc.destroy();
      }
    };
  }, [open, url, kind, mimeType]);

  if (!open || !url) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAttachment(url, name || 'download');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const openBlobInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-950">{title}</div>
            <div className="text-[11px] text-zinc-500">
              {kind === 'pdf'
                ? pageCount
                  ? `PDF preview · ${pageCount} page${pageCount === 1 ? '' : 's'}`
                  : 'PDF preview'
                : kind === 'image'
                  ? 'Image preview'
                  : 'Preview'}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <DownloadOutlinedIcon sx={{ fontSize: 14 }} />
              {downloading ? 'Downloading…' : 'Download'}
            </button>
            <button
              type="button"
              onClick={openBlobInNewTab}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Open
              <OpenInNewIcon sx={{ fontSize: 14 }} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="Close preview"
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-zinc-100 p-3">
          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
              Loading preview…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              {error}
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="h-8 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800"
                >
                  Download instead
                </button>
              </div>
            </div>
          ) : kind === 'image' && blobUrl ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <img
                src={blobUrl}
                alt={title}
                className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-sm"
              />
            </div>
          ) : kind === 'pdf' ? (
            <div ref={pdfContainerRef} className="mx-auto w-full max-w-4xl" />
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
              In-app preview is available for images and PDFs only.
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="cursor-pointer border-none bg-transparent text-xs font-semibold text-zinc-950 underline"
                >
                  Download this file
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
