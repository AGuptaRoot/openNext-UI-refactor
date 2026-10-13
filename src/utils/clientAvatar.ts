/** Default letter-avatar background when no custom color is set. */
export const DEFAULT_CLIENT_AVATAR_COLOR = '#09090b';

export const CLIENT_AVATAR_COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Zinc', value: '#09090b' },
  { label: 'Slate', value: '#334155' },
  { label: 'Teal', value: '#0f766e' },
  { label: 'Blue', value: '#1d4ed8' },
  { label: 'Cyan', value: '#0e7490' },
  { label: 'Green', value: '#166534' },
  { label: 'Amber', value: '#b45309' },
  { label: 'Orange', value: '#c2410c' },
  { label: 'Rose', value: '#be123c' },
  { label: 'Brown', value: '#7c2d12' },
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidClientAvatarColor(value: string | undefined | null): boolean {
  return HEX_COLOR_RE.test(String(value || '').trim());
}

/** Normalize to #RRGGBB when possible; otherwise return default. */
export function resolveClientAvatarColor(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!HEX_COLOR_RE.test(raw)) return DEFAULT_CLIENT_AVATAR_COLOR;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

/** Up to 2 initials from a client/company name. */
export function getClientInitials(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

const CRM_MEDIA_API_BASE = '/api/plugins/openext-crm-suite';

/**
 * Turn stored avatar/media paths into browser-loadable URLs.
 * Legacy `/upload/crm/...` paths are rewritten to the authenticated CRM media stream.
 */
export function resolveClientMediaUrl(url?: string | null): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }
  if (raw.startsWith('/api/plugins/')) {
    return raw;
  }
  if (raw.startsWith('/upload/')) {
    const provider = 'local';
    return `${CRM_MEDIA_API_BASE}/media/file?key=${encodeURIComponent(raw)}&provider=${provider}`;
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  return raw;
}

