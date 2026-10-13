const PLUGIN_ID = 'openext-crm-suite';

function browserOrigin(): string {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  return window.location.origin;
}

function alignLocalhostToCurrentOrigin(absoluteUrl: string): string {
  const origin = browserOrigin();
  if (!origin || !/^https?:\/\//i.test(absoluteUrl)) return absoluteUrl;
  try {
    const parsed = new URL(absoluteUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const current = new URL(origin);
      parsed.protocol = current.protocol;
      parsed.host = current.host;
      return parsed.toString();
    }
  } catch {
    /* keep original */
  }
  return absoluteUrl;
}

function buildPluginPortalUrl(htmlFile: string, token: string): string {
  const origin = browserOrigin();
  const path = `/plugins/${PLUGIN_ID}/ui/portal/${htmlFile}?token=${encodeURIComponent(token)}`;
  return origin ? `${origin}${path}` : path;
}

/**
 * Normalize portal / pay links for CRM UI display + copy.
 * Prefers the public plugin portal HTML URL over SPA hash routes.
 */
export function buildFullPortalLink(options: {
  candidateUrl?: string | null;
  token?: string | null;
  kind: 'invoice' | 'quotation';
}): string {
  const raw = String(options.candidateUrl || '').trim();
  const token = String(options.token || '').trim();
  const origin = browserOrigin();
  const htmlFile = options.kind === 'invoice' ? 'invoice.html' : 'quotation.html';

  if (/^https?:\/\//i.test(raw)) {
    return alignLocalhostToCurrentOrigin(raw);
  }

  if (raw.startsWith('/')) {
    return origin ? `${origin}${raw}` : raw;
  }

  // Hash SPA fallbacks → real plugin portal when token is known
  if (token && (raw.startsWith('#') || raw.startsWith('/#') || /\/(invoices|quotations)\/public\//i.test(raw))) {
    return buildPluginPortalUrl(htmlFile, token);
  }

  if (raw.startsWith('#') || raw.startsWith('/#')) {
    const cleanHash = raw.replace(/^\/?#/, '');
    const pathname =
      typeof window !== 'undefined' ? window.location?.pathname?.replace(/\/+$/, '') || '' : '';
    return `${origin}${pathname}/#${cleanHash.startsWith('/') ? '' : '/'}${cleanHash}`;
  }

  if (token) {
    return buildPluginPortalUrl(htmlFile, token);
  }

  if (raw) {
    return origin ? `${origin}/${raw.replace(/^\/+/, '')}` : raw;
  }

  return '';
}

export function buildFullInvoicePortalLink(candidateUrl?: string, payToken?: string): string {
  return buildFullPortalLink({ candidateUrl, token: payToken, kind: 'invoice' });
}

export function buildFullQuotationPortalLink(candidateUrl?: string, portalToken?: string): string {
  return buildFullPortalLink({ candidateUrl, token: portalToken, kind: 'quotation' });
}
