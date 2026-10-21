import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ExtensionIframe } from '../extensions/ExtensionIframe';
import type { ExtensionPageContribution } from '../../hooks/useExtensions';
import { asExtensionBag } from '../../utils/extensionLeadEmbed';

type Props = {
  leadId: string;
  /** Full Lead.extension bag from CRM. */
  extension?: Record<string, unknown> | null;
  embeds: ExtensionPageContribution[];
  extensionPageUrl: (
    page: ExtensionPageContribution,
    leadId?: string,
    extras?: {
      embed?: boolean;
      mode?: string;
      draftKey?: string;
      params?: Record<string, string | undefined | null>;
    }
  ) => string;
  /** Called when an embed syncs updated extension JSON back to the host (Save only). */
  onExtensionSynced?: (extension: Record<string, unknown>) => void;
};

function extensionFingerprint(ext: unknown): string {
  try {
    return JSON.stringify(ext && typeof ext === 'object' ? ext : {});
  } catch {
    return '';
  }
}

/**
 * Generic Details-tab embeds: CRM supplies leadId + Lead.extension;
 * each extension zip supplies the iframe UI (same pages as Create Lead embeds).
 */
export function LeadExtensionDetailEmbeds({
  leadId,
  extension,
  embeds,
  extensionPageUrl,
  onExtensionSynced,
}: Props) {
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const extensionRef = useRef(extension);
  extensionRef.current = extension;
  const lastHydratedFp = useRef('');
  const lastSyncedFp = useRef('');
  const onSyncedRef = useRef(onExtensionSynced);
  onSyncedRef.current = onExtensionSynced;

  const postHydrate = useCallback(
    (target: Window | null, requestId?: string, force = false, extensionId?: string) => {
      if (!target || !leadId) return;
      const full =
        extensionRef.current && typeof extensionRef.current === 'object'
          ? extensionRef.current
          : {};
      // Isolation: send only that extension's slice when known (e.g. { "crm-travel": {...} }).
      const bag =
        extensionId && full[extensionId] !== undefined
          ? { [extensionId]: full[extensionId] }
          : full;
      const fp = extensionFingerprint(bag) + '|' + String(extensionId || '');
      // Avoid re-posting the same bag (prevents iframe reboot loops).
      if (!force && fp && fp === lastHydratedFp.current) return;
      lastHydratedFp.current = fp;
      const msg = {
        source: 'crm-host',
        type: 'extension-lead-hydrate',
        leadId,
        extension: bag,
        extensionId: extensionId || undefined,
        requestId,
      };
      target.postMessage(msg, '*');
      target.postMessage({ ...msg, type: 'crm-travel-hydrate' }, '*');
    },
    [leadId]
  );

  useEffect(() => {
    if (!leadId || !embeds.length) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      const type = String(data.type || '');
      const wantId = String(data.leadId || '').trim();
      if (wantId && wantId !== leadId) return;

      if (
        type === 'extension-lead-ready' ||
        type === 'crm-travel-ready' ||
        type === 'extension-lead-get' ||
        type === 'crm-travel-get-extension'
      ) {
        const sourceExtId = String(data.extensionId || data.sourceExtId || '').trim();
        const match = embeds.find((e) => !sourceExtId || e.extensionId === sourceExtId);
        // Ready/get always answers with that extension's Lead.extension slice.
        postHydrate(
          event.source as Window | null,
          data.requestId ? String(data.requestId) : undefined,
          true,
          match?.extensionId || sourceExtId || undefined
        );
        return;
      }

      // Read-only view pages must never sync — ignore accidental sync messages from embeds.
      if (type === 'extension-lead-sync' || type === 'crm-travel-sync') {
        const ext = asExtensionBag(data.extension);
        if (!ext || !Object.keys(ext).length) return;
        const fp = extensionFingerprint(ext);
        if (fp && (fp === lastSyncedFp.current || fp === extensionFingerprint(extensionRef.current))) {
          return;
        }
        lastSyncedFp.current = fp;
        onSyncedRef.current?.(ext);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [leadId, embeds.length, postHydrate]);

  // Only re-hydrate when CRM extension content actually changes (not object identity).
  const extensionFp = useMemo(() => extensionFingerprint(extension), [extension]);
  useEffect(() => {
    if (!extensionFp) return;
    for (const emb of embeds) {
      const win = iframeRefs.current[emb.tabId]?.contentWindow || null;
      postHydrate(win, undefined, true, emb.extensionId);
    }
  }, [extensionFp, embeds, postHydrate]);

  const sorted = useMemo(
    () => [...embeds].sort((a, b) => (a.order || 100) - (b.order || 100)),
    [embeds]
  );

  if (!leadId || !sorted.length) return null;

  return (
    <div className="flex flex-col gap-4" data-testid="leads-extension-detail-embeds">
      {sorted.map((emb) => {
        const src = extensionPageUrl(emb, leadId, {
          embed: true,
          mode: 'view',
          params: { leadId, view: '1' },
        });
        return (
          <div
            key={emb.tabId}
            className="bg-white border border-zinc-300 rounded-lg p-6"
            data-testid={`lead-extension-embed-${emb.extensionId}`}
          >
            <h3 className="m-0 text-sm font-bold text-zinc-950">
              {emb.label || emb.title || emb.extensionId}
            </h3>
            <p className="mb-3 mt-1 text-xs text-zinc-500">
              {emb.hintMessage || (
                <>
                  Read-only UI from <code className="text-[11px]">{emb.extensionId}</code> — data
                  from this CRM lead.
                </>
              )}
            </p>
            <ExtensionIframe
              iframeRef={(el) => {
                iframeRefs.current[emb.tabId] = el;
              }}
              title={emb.label || emb.title || emb.extensionId}
              src={src}
              minHeight="28rem"
            />
          </div>
        );
      })}
    </div>
  );
}
