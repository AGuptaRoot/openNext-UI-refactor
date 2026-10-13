/** Compress an image File to a data URL suitable for Groq vision APIs. */

const MAX_EDGE = 1600;
const MAX_BYTES_TARGET = 1.2 * 1024 * 1024;
const JPEG_QUALITY_STEPS = [0.82, 0.7, 0.58, 0.48];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = dataUrl;
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

function approxByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Returns a `data:image/jpeg;base64,...` (or original small PNG/WebP) URL for Groq vision.
 */
export async function fileToVisionDataUrl(file: File): Promise<string> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Image must be 12 MB or smaller');
  }

  const original = await readAsDataUrl(file);
  // Small enough already and JPEG/PNG/WebP — still normalize via canvas for consistent JPEG.
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: send original data URL if canvas unavailable
    if (original.startsWith('data:image/')) return original;
    throw new Error('Could not process image');
  }
  ctx.drawImage(img, 0, 0, width, height);

  let best = canvasToJpegDataUrl(canvas, JPEG_QUALITY_STEPS[0]);
  for (const q of JPEG_QUALITY_STEPS) {
    const candidate = canvasToJpegDataUrl(canvas, q);
    best = candidate;
    if (approxByteLength(candidate) <= MAX_BYTES_TARGET) break;
  }

  if (approxByteLength(best) > 4 * 1024 * 1024) {
    throw new Error('Image is still too large after compression. Try a clearer, closer photo.');
  }

  return best;
}
