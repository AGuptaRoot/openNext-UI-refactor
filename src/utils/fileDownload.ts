/**
 * Multi-strategy file download utility adapted from openext-crm-suite (ui/admin/utils/ui.js).
 * Bypasses iframe sandbox download restrictions in OpenNext CMS by:
 * 1. Targeting parent/top document context if accessible (cross-origin safe)
 * 2. UTF-8 BOM (\uFEFF) for Excel-compatible CSV exports
 * 3. Synthetic MouseEvent dispatch
 * 4. Fallbacks: local blob, data URI, and direct URL
 */

export interface DownloadFileOptions {
  filename?: string;
  content?: string | Blob;
  format?: string;
  mimeType?: string;
  directUrl?: string;
}

export function triggerFileDownload(options: DownloadFileOptions = {}): boolean {
  const filename = options.filename || 'export.csv';
  const content = options.content !== undefined ? options.content : '';
  const format = (options.format || (filename.endsWith('.json') ? 'json' : 'csv')).toLowerCase();
  const isJson = format === 'json' || filename.endsWith('.json');
  const mimeType =
    options.mimeType ||
    (isJson ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;');
  const directUrl = options.directUrl || '';

  // Create Blob with Excel-friendly UTF-8 BOM for CSV
  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else {
    const blobParts = isJson ? [content] : ['\uFEFF', content];
    blob = new Blob(blobParts, { type: mimeType });
  }

  // Strategy 1: IE / legacy Edge
  const nav = window.navigator as unknown as { msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean };
  if (nav && typeof nav.msSaveOrOpenBlob === 'function') {
    try {
      nav.msSaveOrOpenBlob(blob, filename);
      return true;
    } catch (err) {
      console.warn('[triggerFileDownload] msSaveOrOpenBlob fallback:', err);
    }
  }

  // Determine target document (Top / Parent context bypasses iframe sandbox download restrictions)
  let targetDoc: Document = document;
  let targetWindow: Window = window;
  try {
    if (window.top && window.top !== window && window.top.document && window.top.document.body) {
      targetDoc = window.top.document;
      targetWindow = window.top;
    } else if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) {
      targetDoc = window.parent.document;
      targetWindow = window.parent;
    }
  } catch {
    // Cross-origin security boundary, fallback to local document
    targetDoc = document;
    targetWindow = window;
  }

  let downloadTriggered = false;

  // Strategy 2: Blob URL trigger in target document
  try {
    const winWithUrl = targetWindow as unknown as { URL?: typeof URL; webkitURL?: typeof URL };
    const urlCreator = winWithUrl.URL || window.URL || winWithUrl.webkitURL;
    if (!urlCreator) throw new Error('URL.createObjectURL not supported');
    const objectUrl = urlCreator.createObjectURL(blob);
    const link = targetDoc.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', filename);
    link.download = filename;
    link.style.display = 'none';
    link.style.position = 'absolute';
    link.style.left = '-9999px';
    targetDoc.body.appendChild(link);

    // Trigger synthetic click event
    try {
      const clickEvent = new MouseEvent('click', {
        view: targetWindow,
        bubbles: true,
        cancelable: true,
      });
      link.dispatchEvent(clickEvent);
    } catch {
      link.click();
    }

    downloadTriggered = true;

    // Clean up object URL after browser registers the download
    setTimeout(() => {
      try {
        link.remove();
        urlCreator.revokeObjectURL(objectUrl);
      } catch {}
    }, 15000);
  } catch (blobErr) {
    console.warn('[triggerFileDownload] Primary blob download failed:', blobErr);
  }

  // Strategy 3: Local document blob fallback if targetDoc was different and threw
  if (!downloadTriggered) {
    try {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', filename);
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      downloadTriggered = true;
      setTimeout(() => {
        try {
          link.remove();
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 15000);
    } catch (err) {
      console.warn('[triggerFileDownload] Local blob fallback failed:', err);
    }
  }

  // Strategy 4: Data URI fallback for string content
  if (!downloadTriggered && typeof content === 'string' && content.length < 2000000) {
    try {
      const encoded = encodeURIComponent(content);
      const dataUri = `data:${mimeType},${encoded}`;
      const link = (targetDoc || document).createElement('a');
      link.href = dataUri;
      link.setAttribute('download', filename);
      link.download = filename;
      link.style.display = 'none';
      (targetDoc || document).body.appendChild(link);
      link.click();
      downloadTriggered = true;
      setTimeout(() => {
        try {
          link.remove();
        } catch {}
      }, 5000);
    } catch (dataErr) {
      console.warn('[triggerFileDownload] Data URI fallback failed:', dataErr);
    }
  }

  // Strategy 5: Direct URL fallback if provided
  if (!downloadTriggered && directUrl) {
    try {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      downloadTriggered = true;
    } catch (navErr) {
      console.warn('[triggerFileDownload] Direct URL navigation failed:', navErr);
    }
  }

  return downloadTriggered;
}
