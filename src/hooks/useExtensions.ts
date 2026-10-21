import { useCallback, useEffect, useMemo, useState } from 'react';
import { crmApi } from '../services/api';

export type ExtensionPageContribution = {
  extensionId: string;
  id: string;
  tabId: string;
  title: string;
  label: string;
  entry: string;
  url: string;
  slot: string;
  whenRequestTypeKey: string | null;
  whenRequestTypeName: string | null;
  appendLeadId: boolean;
  openOnCreate: boolean;
  order: number;
  hintMessage: string;
};

export type ExtensionSettingsContribution = {
  extensionId: string;
  key: string;
  tabId: string;
  label: string;
  url: string;
  order: number;
};

export type ExtensionFieldDef = {
  id: string;
  label: string;
  fieldType: string;
  required?: boolean;
  readOnly?: boolean;
  order?: number;
  options?: Array<{ value?: string; label?: string; optionKey?: string }>;
  placeholder?: string;
  helpText?: string;
  section?: string | null;
  whenRequestTypeKey?: string | null;
  whenRequestTypeName?: string | null;
};

/** Native Create Lead field groups (no nested iframe). */
export type ExtensionLeadCreateFields = {
  extensionId: string;
  sectionLabel: string;
  whenRequestTypeKey?: string | null;
  whenRequestTypeName?: string | null;
  logicUrl?: string;
  schemaUrl?: string;
  order?: number;
  fields: ExtensionFieldDef[];
};

export type ExtensionUiSummary = {
  extensions: Array<{ extensionId: string; version?: string; hostSlotsUrl?: string }>;
  navigation: Array<{
    extensionId: string;
    id: string;
    label: string;
    url: string;
    order: number;
  }>;
  pages: ExtensionPageContribution[];
  modulePages: ExtensionPageContribution[];
  settings: ExtensionSettingsContribution[];
  leadDetailTabs: ExtensionPageContribution[];
  /** Details-tab iframes (UI from extension zip; data from Lead.extension). */
  leadDetailEmbeds: ExtensionPageContribution[];
  leadCreateHints: ExtensionPageContribution[];
  /** Generic Create Lead fields slot — contributions.fields + ui/fields/calc.js */
  leadCreateFields?: ExtensionLeadCreateFields[];
  requestTypes: Array<{
    extensionId: string;
    key: string;
    name: string;
    description?: string;
  }>;
};

type HostSlotsFile = {
  modulePageIds?: string[];
  settings?: Array<{ pageId?: string; key?: string; label?: string; order?: number }>;
  leadDetailTabs?: Array<{
    pageId?: string;
    label?: string;
    whenRequestTypeKey?: string;
    whenRequestTypeName?: string;
    appendLeadId?: boolean;
    openOnCreate?: boolean;
    order?: number;
    hintMessage?: string;
  }>;
  leadCreateEmbeds?: Array<{
    pageId?: string;
    label?: string;
    whenRequestTypeKey?: string;
    whenRequestTypeName?: string;
    openOnCreate?: boolean;
    order?: number;
    hintMessage?: string;
  }>;
  /** Same shape as create embeds — shown on Lead Details with leadId + hydrate. */
  leadDetailEmbeds?: Array<{
    pageId?: string;
    label?: string;
    whenRequestTypeKey?: string;
    whenRequestTypeName?: string;
    openOnCreate?: boolean;
    order?: number;
    hintMessage?: string;
  }>;
  requestTypes?: Array<{ key?: string; name?: string; description?: string }>;
};

function matchesRequestType(
  page: Pick<ExtensionPageContribution, 'whenRequestTypeKey' | 'whenRequestTypeName'>,
  requestType?: { key?: string | null; name?: string | null } | null
): boolean {
  const key = String(requestType?.key || '')
    .trim()
    .toLowerCase();
  const name = String(requestType?.name || '')
    .trim()
    .toLowerCase();
  if (!page.whenRequestTypeKey && !page.whenRequestTypeName) return true;
  if (page.whenRequestTypeKey && page.whenRequestTypeKey === key) return true;
  if (page.whenRequestTypeName && page.whenRequestTypeName === name) return true;
  return false;
}

function mergeHostSlotsIntoSummary(data: ExtensionUiSummary, extensionId: string, slots: HostSlotsFile) {
  if (!data.settings) data.settings = [];
  if (!data.leadDetailTabs) data.leadDetailTabs = [];
  if (!data.leadDetailEmbeds) data.leadDetailEmbeds = [];
  if (!data.modulePages) data.modulePages = [];
  if (!data.requestTypes) data.requestTypes = [];
  if (!data.leadCreateHints) data.leadCreateHints = [];
  if (!data.leadCreateFields) data.leadCreateFields = [];
  if (!data.pages) data.pages = [];

  const pageById = new Map(
    (data.pages || [])
      .filter((p) => p.extensionId === extensionId)
      .map((p) => [p.id, p] as const)
  );

  // Explicit empty modulePageIds = no sidebar modules for this extension (clear auto-added ones).
  if (Array.isArray(slots.modulePageIds) && slots.modulePageIds.length === 0) {
    data.modulePages = (data.modulePages || []).filter((p) => p.extensionId !== extensionId);
  } else {
    for (const id of slots.modulePageIds || []) {
      const page = pageById.get(String(id));
      if (!page) continue;
      if (data.modulePages.some((x) => x.tabId === page.tabId)) continue;
      data.modulePages.push({ ...page, slot: 'module' });
    }
  }

  for (const s of slots.settings || []) {
    const page = pageById.get(String(s.pageId || s.key || ''));
    if (!page) continue;
    const tabId = `ext__${extensionId}__${s.key || s.pageId}`;
    if (data.settings.some((x) => x.tabId === tabId)) continue;
    data.settings.push({
      extensionId,
      key: String(s.key || s.pageId),
      tabId,
      label: s.label || s.pageId || page.title,
      url: page.url,
      order: Number(s.order || 100),
    });
  }

  for (const tab of slots.leadDetailTabs || []) {
    const page = pageById.get(String(tab.pageId || ''));
    if (!page) continue;
    const tabId = `ext__${extensionId}__${tab.pageId}`;
    if (data.leadDetailTabs.some((x) => x.tabId === tabId)) continue;
    const item: ExtensionPageContribution = {
      ...page,
      tabId,
      label: tab.label || page.title,
      title: tab.label || page.title,
      slot: 'lead.detail.tab',
      whenRequestTypeKey: tab.whenRequestTypeKey
        ? String(tab.whenRequestTypeKey).trim().toLowerCase()
        : null,
      whenRequestTypeName: tab.whenRequestTypeName
        ? String(tab.whenRequestTypeName).trim().toLowerCase()
        : null,
      appendLeadId: tab.appendLeadId !== false,
      openOnCreate: !!tab.openOnCreate,
      order: Number(tab.order || 100),
      hintMessage: tab.hintMessage || '',
    };
    data.leadDetailTabs.push(item);
    if (item.openOnCreate && !data.leadCreateHints.some((x) => x.tabId === tabId)) {
      data.leadCreateHints.push(item);
    }
  }

  for (const rt of slots.requestTypes || []) {
    if (!rt?.key) continue;
    const key = String(rt.key).toLowerCase();
    if (data.requestTypes.some((x) => x.key === key && x.extensionId === extensionId)) continue;
    data.requestTypes.push({
      extensionId,
      key,
      name: rt.name || rt.key,
      description: rt.description || '',
    });
  }

  for (const emb of slots.leadCreateEmbeds || []) {
    const page = pageById.get(String(emb.pageId || ''));
    if (!page) continue;
    const tabId = `ext__${extensionId}__${emb.pageId}`;
    if (data.leadCreateHints.some((x) => x.tabId === tabId)) continue;
    data.leadCreateHints.push({
      ...page,
      tabId,
      label: emb.label || page.title,
      title: emb.label || page.title,
      slot: 'lead.create.embed',
      whenRequestTypeKey: emb.whenRequestTypeKey
        ? String(emb.whenRequestTypeKey).trim().toLowerCase()
        : null,
      whenRequestTypeName: emb.whenRequestTypeName
        ? String(emb.whenRequestTypeName).trim().toLowerCase()
        : null,
      appendLeadId: false,
      openOnCreate: emb.openOnCreate !== false,
      order: Number(emb.order || 100),
      hintMessage: emb.hintMessage || '',
    });
  }

  // Explicit empty leadDetailEmbeds = no Details-tab iframes (native Lead.extension panels instead).
  const detailEmbedDefs = Array.isArray(slots.leadDetailEmbeds)
    ? slots.leadDetailEmbeds
    : slots.leadCreateEmbeds || [];
  for (const emb of detailEmbedDefs) {
    const page = pageById.get(String(emb.pageId || ''));
    if (!page) continue;
    const tabId = `ext__${extensionId}__detail__${emb.pageId}`;
    if (data.leadDetailEmbeds.some((x) => x.tabId === tabId)) continue;
    data.leadDetailEmbeds.push({
      ...page,
      tabId,
      label: emb.label || page.title,
      title: emb.label || page.title,
      slot: 'lead.detail.embed',
      whenRequestTypeKey: emb.whenRequestTypeKey
        ? String(emb.whenRequestTypeKey).trim().toLowerCase()
        : null,
      whenRequestTypeName: emb.whenRequestTypeName
        ? String(emb.whenRequestTypeName).trim().toLowerCase()
        : null,
      appendLeadId: true,
      openOnCreate: false,
      order: Number(emb.order || 100),
      hintMessage: emb.hintMessage || '',
    });
  }
}

export function useExtensions() {
  const [summary, setSummary] = useState<ExtensionUiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.getExtensionsUi();
      let data = (res.data as ExtensionUiSummary) || null;
      if (data && !data.leadDetailEmbeds) data.leadDetailEmbeds = [];

      // Always merge ui/host-slots.json in the browser (server-side fetch often fails behind CMS auth).
      if (data?.extensions?.length) {
        await Promise.all(
          data.extensions.map(async (ext) => {
            try {
              const url =
                ext.hostSlotsUrl ||
                `/extensions/${encodeURIComponent(ext.extensionId)}/ui/pages/host-slots.html`;
              const slotsRes = await fetch(url, { credentials: 'include' });
              if (!slotsRes.ok) return;
              const text = await slotsRes.text();
              let slots: HostSlotsFile | null = null;
              try {
                slots = JSON.parse(text) as HostSlotsFile;
              } catch {
                const m = text.match(/id="host-slots">([\s\S]*?)<\/script>/);
                if (m?.[1]) slots = JSON.parse(m[1]) as HostSlotsFile;
              }
              if (!slots || !data) return;
              mergeHostSlotsIntoSummary(data, ext.extensionId, slots);
              try {
                await crmApi.syncExtensionHostSlots(ext.extensionId, slots);
              } catch {
                /* optional cache for request-type seeding */
              }
            } catch {
              /* optional */
            }
          })
        );
      }

      setSummary(data);
    } catch (reason) {
      setSummary(null);
      setError(reason instanceof Error ? reason.message : 'Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasExtensions = (summary?.extensions?.length || 0) > 0;

  const leadTabsForRequestType = useCallback(
    (requestType?: { key?: string | null; name?: string | null } | null) => {
      return (summary?.leadDetailTabs || []).filter((tab) => matchesRequestType(tab, requestType));
    },
    [summary]
  );

  const createHintsForRequestType = useCallback(
    (requestType?: { key?: string | null; name?: string | null } | null) => {
      const fromHints = (summary?.leadCreateHints || []).filter((h) =>
        matchesRequestType(h, requestType)
      );
      const fromOpenOnCreate = (summary?.leadDetailTabs || []).filter(
        (t) => t.openOnCreate && matchesRequestType(t, requestType)
      );
      const seen = new Set<string>();
      const merged: ExtensionPageContribution[] = [];
      for (const item of [...fromHints, ...fromOpenOnCreate]) {
        if (seen.has(item.tabId)) continue;
        seen.add(item.tabId);
        merged.push(item);
      }
      return merged;
    },
    [summary]
  );

  /** Native field groups for Create Lead (prefer over iframe embeds). */
  const createFieldsForRequestType = useCallback(
    (requestType?: { key?: string | null; name?: string | null } | null) => {
      return (summary?.leadCreateFields || []).filter((g) =>
        matchesRequestType(
          {
            whenRequestTypeKey: g.whenRequestTypeKey || null,
            whenRequestTypeName: g.whenRequestTypeName || null,
          },
          requestType
        )
      );
    },
    [summary]
  );

  /**
   * Details-tab iframes (legacy). Prefer native LeadExtensionDataSections.
   * Empty leadDetailEmbeds means no iframes — do not fall back to create embeds.
   */
  const detailEmbedsForLead = useCallback(
    (
      requestType?: { key?: string | null; name?: string | null } | null,
      extension?: Record<string, unknown> | null
    ) => {
      const fromSlots = Array.isArray(summary?.leadDetailEmbeds)
        ? summary.leadDetailEmbeds
        : [];
      const extKeys = new Set(
        extension && typeof extension === 'object' ? Object.keys(extension) : []
      );
      return fromSlots.filter((emb) => {
        if (matchesRequestType(emb, requestType)) return true;
        if (extKeys.has(emb.extensionId)) return true;
        return false;
      });
    },
    [summary]
  );

  const extensionPageUrl = useCallback(
    (
      page: ExtensionPageContribution,
      leadId?: string,
      extras?: {
        embed?: boolean;
        mode?: string;
        draftKey?: string;
        params?: Record<string, string | undefined | null>;
      }
    ) => {
      if (!page?.url) return '';
      const params = new URLSearchParams();
      if (page.appendLeadId && leadId) params.set('leadId', leadId);
      if (extras?.embed) params.set('embed', '1');
      if (extras?.mode) params.set('mode', extras.mode);
      if (extras?.draftKey) params.set('draftKey', extras.draftKey);
      for (const [k, v] of Object.entries(extras?.params || {})) {
        if (v == null || v === '') continue;
        params.set(k, String(v));
      }
      const qs = params.toString();
      if (!qs) return page.url;
      return `${page.url}${page.url.includes('?') ? '&' : '?'}${qs}`;
    },
    []
  );

  const settingsTabs = useMemo(() => summary?.settings || [], [summary]);
  const modulePages = useMemo(() => summary?.modulePages || [], [summary]);
  const navigation = useMemo(() => summary?.navigation || [], [summary]);

  return {
    summary,
    loading,
    error,
    reload,
    hasExtensions,
    settingsTabs,
    modulePages,
    navigation,
    leadTabsForRequestType,
    createHintsForRequestType,
    createFieldsForRequestType,
    detailEmbedsForLead,
    extensionPageUrl,
  };
}
