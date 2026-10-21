import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ExtensionIframe } from './ExtensionIframe';
import type { ExtensionPageContribution } from '../../hooks/useExtensions';
import { asExtensionBag } from '../../utils/extensionLeadEmbed';

export type ExtensionTabProps = {
  /** Active when this lead-detail extension tab is selected. */
  active?: boolean;
  leadId: string;
  /** Full Lead.extension bag from CRM. */
  extension?: Record<string, unknown> | null;
  tab: ExtensionPageContribution;
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
  /** Persist extension JSON when the iframe saves / syncs. */
  onExtensionSynced?: (extension: Record<string, unknown>) => void;
  minHeight?: string;
  className?: string;
};

function extensionFingerprint(ext: unknown): string {
  try {
    return JSON.stringify(ext && typeof ext === 'object' ? ext : {});
  } catch {
    return '';
  }
}

/**
 * Generic Lead Detail extension tab.
 * CRM hosts the tab chrome; the extension package supplies the iframe form
 * (e.g. Travel Requirement when request type is Travel).
 */
export function ExtensionTab({
  active = true,
  leadId,
  extension,
  tab,
  extensionPageUrl,
  onExtensionSynced,
  minHeight = '42rem',
  className = '',
}: ExtensionTabProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const extensionRef = useRef(extension);
  extensionRef.current = extension;
  const lastHydratedFp = useRef('');
  const lastSyncedFp = useRef('');
  const onSyncedRef = useRef(onExtensionSynced);
  onSyncedRef.current = onExtensionSynced;

  const postHydrate = useCallback(
    (target: Window | null, requestId?: string, force = false) => {
      if (!target || !leadId) return;
      const full =
        extensionRef.current && typeof extensionRef.current === 'object'
          ? extensionRef.current
          : {};
      const extensionId = tab.extensionId;
      const bag =
        extensionId && full[extensionId] !== undefined
          ? { [extensionId]: full[extensionId] }
          : full;
      const fp = extensionFingerprint(bag) + '|' + String(extensionId || '');
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
      // Legacy travel alias until all extension pages migrate.
      target.postMessage({ ...msg, type: 'crm-travel-hydrate' }, '*');
    },
    [leadId, tab.extensionId]
  );

  useEffect(() => {
    if (!active || !leadId) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      const type = String(data.type || '');
      const wantId = String(data.leadId || '').trim();
      if (wantId && wantId !== leadId) return;

      const sourceExtId = String(data.extensionId || data.sourceExtId || '').trim();
      if (sourceExtId && tab.extensionId && sourceExtId !== tab.extensionId) return;

      if (
        type === 'extension-lead-ready' ||
        type === 'crm-travel-ready' ||
        type === 'extension-lead-get' ||
        type === 'crm-travel-get-extension'
      ) {
        postHydrate(
          event.source as Window | null,
          data.requestId ? String(data.requestId) : undefined,
          true
        );
        return;
      }

      if (type === 'extension-lead-sync' || type === 'crm-travel-sync') {
        const ext = asExtensionBag(data.extension);
        if (!ext || !Object.keys(ext).length) return;
        const fp = extensionFingerprint(ext);
        if (
          fp &&
          (fp === lastSyncedFp.current || fp === extensionFingerprint(extensionRef.current))
        ) {
          return;
        }
        lastSyncedFp.current = fp;
        onSyncedRef.current?.(ext);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, leadId, tab.extensionId, postHydrate]);

  const extensionFp = useMemo(() => extensionFingerprint(extension), [extension]);
  useEffect(() => {
    if (!active || !extensionFp) return;
    postHydrate(iframeRef.current?.contentWindow || null, undefined, true);
  }, [active, extensionFp, postHydrate]);

  if (!active || !leadId) return null;

  const src = extensionPageUrl(tab, leadId, {
    embed: true,
    mode: 'requirement',
    params: { leadId, view: '1' },
  });

  return (
    <div
      className={`flex flex-col gap-3 ${className}`}
      data-testid="leads-extension-tab"
      data-extension-id={tab.extensionId}
      data-extension-page={tab.id}
    >
      <div className="bg-white border border-zinc-300 rounded-lg px-4 py-3">
        <h3 className="m-0 text-sm font-bold text-zinc-950">
          {tab.label || tab.title || 'Extension'}
        </h3>
        <p className="mb-0 mt-1 text-xs text-zinc-500">
          {tab.hintMessage || (
            <>
              Extension form from <code className="text-[11px]">{tab.extensionId}</code>
            </>
          )}
        </p>
      </div>
      <ExtensionIframe
        iframeRef={iframeRef}
        title={tab.label || tab.title || tab.extensionId}
        src={src}
        minHeight={minHeight}
      />
    </div>
  );
}
