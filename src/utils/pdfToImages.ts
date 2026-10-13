import * as pdfjsLib from 'pdfjs-dist';

let pdfWorkerReady: Promise<void> | null = null;

function ensurePdfWorker(): Promise<void> {
  if (!pdfWorkerReady) {
    pdfWorkerReady = (async () => {
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs');
      (
        globalThis as typeof globalThis & {
          pdfjsWorker?: { WorkerMessageHandler: unknown };
        }
      ).pdfjsWorker = workerMod;
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';
      }
    })();
  }
  return pdfWorkerReady;
}

export interface PdfToImagesOptions {
  /** Max pages to render (Groq payload size). Default 6. */
  maxPages?: number;
  /** Scale for canvas render. Default 1.5 */
  scale?: number;
  /** JPEG quality 0–1. Default 0.72 */
  quality?: number;
}

/**
 * Render PDF pages to JPEG data URLs for Groq vision extract.
 */
export async function pdfFileToImageDataUrls(
  file: File,
  options: PdfToImagesOptions = {}
): Promise<{ imageDataUrls: string[]; pageCount: number }> {
  const maxPages = Math.max(1, Math.min(12, options.maxPages ?? 6));
  const scale = options.scale ?? 1.5;
  const quality = options.quality ?? 0.72;

  await ensurePdfWorker();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageCount = pdf.numPages;
  const imageDataUrls: string[] = [];
  const limit = Math.min(pageCount, maxPages);

  for (let pageNum = 1; pageNum <= limit; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.startsWith('data:image/jpeg')) {
      imageDataUrls.push(dataUrl);
    }
    canvas.width = 0;
    canvas.height = 0;
  }

  if (!imageDataUrls.length) {
    throw new Error('Could not render PDF pages. Try another file.');
  }

  return { imageDataUrls, pageCount };
}
