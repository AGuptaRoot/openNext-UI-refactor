/**
 * Generic host ↔ extension bridge for Lead Create embeds.
 * Extensions own field UI/validation; CRM mounts iframes and persists
 * returned `extension` JSON on the Lead document (no Travel hardcode).
 * Never read/write extension lead drafts from localStorage / sessionStorage.
 */

export type ExtensionLeadCommitResult = {
  ok: boolean;
  error?: string;
  /** JSON bag to merge onto Lead.extension (e.g. { from, to, destination }). */
  extension?: Record<string, unknown>;
};

/** postMessage types extensions use to sync JSON onto CRM Lead.extension. */
export const EXTENSION_LEAD_SYNC_TYPES = [
  'extension-lead-sync',
  'crm-travel-sync',
] as const;

export const EXTENSION_LEAD_GET_TYPES = [
  'extension-lead-get',
  'crm-travel-get-extension',
] as const;

export function asExtensionBag(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function isExtensionLeadSyncMessage(data: unknown): data is {
  type: string;
  leadId?: string;
  extension?: unknown;
  source?: string;
} {
  if (!data || typeof data !== 'object') return false;
  const type = String((data as { type?: string }).type || '');
  return (EXTENSION_LEAD_SYNC_TYPES as readonly string[]).includes(type);
}

export function isExtensionLeadGetMessage(data: unknown): data is {
  type: string;
  leadId?: string;
  requestId?: string;
  source?: string;
} {
  if (!data || typeof data !== 'object') return false;
  const type = String((data as { type?: string }).type || '');
  return (EXTENSION_LEAD_GET_TYPES as readonly string[]).includes(type);
}

/** Stable draft key for an extension create-embed contribution (postMessage only). */
export function extensionCreateDraftKey(extensionId: string, pageId: string): string {
  return `crm_ext_lead_create_draft__${extensionId}__${pageId}`;
}

/**
 * Ask an extension iframe for its current create draft / extension JSON
 * before the CRM Lead is created (so createLead can include `extension`).
 */
export function requestExtensionLeadDraft(
  iframe: HTMLIFrameElement | null,
  options?: { timeoutMs?: number; draftKey?: string }
): Promise<Record<string, unknown> | null> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  return new Promise((resolve) => {
    if (!iframe?.contentWindow) {
      resolve(null);
      return;
    }
    const requestId = `ext_draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      // Only accept the response for this request (ignore spontaneous draft broadcasts).
      if (data.requestId !== requestId) return;
      const isDraft =
        data.type === 'extension-lead-draft' ||
        data.type === 'crm-travel-draft' ||
        data.type === 'extension-lead-get-draft-result';
      if (!isDraft) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      const ext =
        asExtensionBag(data.extension) ||
        asExtensionBag(data.payload?.extension) ||
        null;
      resolve(ext);
    };

    window.addEventListener('message', onMessage);
    iframe.contentWindow.postMessage(
      {
        source: 'crm-host',
        type: 'extension-lead-get-draft',
        requestId,
      },
      '*'
    );
    // Legacy alias some embeds still listen for
    iframe.contentWindow.postMessage(
      {
        source: 'crm-host',
        type: 'crm-travel-get-draft',
        requestId,
      },
      '*'
    );
  });
}

/**
 * Ask an extension iframe to attach its create draft to a new leadId.
 * Sends `extension-lead-commit`; extensions may also accept legacy aliases.
 * On success, `extension` JSON is returned for CRM to PATCH onto the Lead.
 */
export function commitExtensionLeadEmbed(
  iframe: HTMLIFrameElement | null,
  leadId: string,
  timeoutMs = 4000
): Promise<ExtensionLeadCommitResult> {
  return new Promise((resolve) => {
    if (!iframe?.contentWindow || !leadId) {
      resolve({ ok: false, error: 'Extension embed is not ready.' });
      return;
    }
    const requestId = `ext_commit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve({ ok: false, error: 'Extension did not confirm save in time.' });
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.requestId && data.requestId !== requestId) return;
      // Generic ack; also accept legacy travel alias until all extensions migrate.
      const isCommitAck =
        data.type === 'extension-lead-committed' || data.type === 'crm-travel-committed';
      if (!isCommitAck) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve({
        ok: !!data.ok,
        error: data.error ? String(data.error) : undefined,
        extension: asExtensionBag(data.extension),
      });
    };

    window.addEventListener('message', onMessage);
    iframe.contentWindow.postMessage(
      {
        source: 'crm-host',
        type: 'extension-lead-commit',
        leadId,
        requestId,
      },
      '*'
    );
  });
}
