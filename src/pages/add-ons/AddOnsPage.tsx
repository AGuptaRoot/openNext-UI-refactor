import React, { useEffect, useMemo, useState } from 'react';
import FlightOutlinedIcon from '@mui/icons-material/FlightOutlined';
import { ExtensionIframe } from '../../components/extensions/ExtensionIframe';
import { useExtensions } from '../../hooks/useExtensions';

/**
 * Sidebar module: Travel (formerly Add-ons).
 * Hosts crm-travel travel.html — Services + Service Fields form builder.
 */
export const AddOnsPage: React.FC = () => {
  const { loading, error, reload, hasExtensions, modulePages, navigation, settingsTabs } =
    useExtensions();

  const items = useMemo(() => {
    const fromModules = modulePages.length
      ? modulePages
      : navigation.map((nav) => ({
          extensionId: nav.extensionId,
          id: nav.id,
          tabId: `ext__${nav.extensionId}__${nav.id}`,
          title: nav.label,
          label: nav.label,
          entry: '',
          url: nav.url,
          slot: 'module',
          whenRequestTypeKey: null,
          whenRequestTypeName: null,
          appendLeadId: false,
          openOnCreate: false,
          order: nav.order,
          hintMessage: '',
        }));

    // Prefer Travel settings page when module slots are empty but Settings → Travel exists.
    if (!fromModules.length && settingsTabs.length) {
      return settingsTabs
        .filter((t) => t.extensionId === 'crm-travel' || /travel/i.test(t.label || t.key || ''))
        .map((t) => ({
          extensionId: t.extensionId,
          id: t.key,
          tabId: t.tabId,
          title: t.label || 'Travel',
          label: t.label || 'Travel',
          entry: '',
          url: t.url,
          slot: 'module',
          whenRequestTypeKey: null,
          whenRequestTypeName: null,
          appendLeadId: false,
          openOnCreate: false,
          order: t.order,
          hintMessage: '',
        }));
    }
    return fromModules;
  }, [modulePages, navigation, settingsTabs]);

  const preferred =
    items.find((i) => /^travel-requirement$|travel-requirement|travel$|travel-settings|travel/i.test(i.id || i.label || i.title || '')) ||
    items[0] ||
    null;

  const [activeId, setActiveId] = useState<string>('');
  useEffect(() => {
    if (!activeId && preferred) setActiveId(preferred.tabId);
  }, [activeId, preferred]);

  const active = items.find((i) => i.tabId === activeId) || preferred;

  return (
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-700 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
            Extension module
          </p>
          <h1 className="m-0 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            <FlightOutlinedIcon fontSize="small" className="text-zinc-500" />
            Travel requirement
          </h1>
          <p className="mb-0 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Configure Travel services and build requirement forms per service (Hotel, Bus Ticket,
            Air Ticket, Transport, …). Select a service, then add and manage fields (Input, Selection,
            Multi Choose, Radio, Date, Number, Textarea, Checkbox).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        >
          Refresh
        </button>
      </header>

      {loading && (
        <div className="py-16 text-center text-sm text-zinc-500">Loading Travel module…</div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      )}

      {!loading && !hasExtensions && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Enable the <code>crm-travel</code> extension to use the Travel module.
        </div>
      )}

      {!loading && hasExtensions && !items.length && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Travel extension is enabled but no Travel settings page was found. Redeploy{' '}
          <code>crm-travel</code>.
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {items.length > 1 ? (
            <nav className="flex flex-wrap gap-2" aria-label="Travel pages">
              {items.map((item) => (
                <button
                  key={item.tabId}
                  type="button"
                  onClick={() => setActiveId(item.tabId)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    (active?.tabId || items[0].tabId) === item.tabId
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200'
                  }`}
                >
                  {item.label || item.title}
                </button>
              ))}
            </nav>
          ) : null}
          {active && (
            <ExtensionIframe
              src={active.url}
              title={active.title || 'Travel'}
              minHeight="48rem"
            />
          )}
        </>
      )}
    </div>
  );
};
