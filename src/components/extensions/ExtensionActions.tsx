import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import type { ExtensionActionDef } from '../../types/extensions';
import { getExtensionIcon } from './extensionIcons';
import { ExtensionMount, type ExtensionMountRecord } from './ExtensionMount';

/**
 * Buttons the active extension adds to a core detail page (json/actions.json). "route" actions run on the
 * server (which checks permission and the record's state again); "mount" actions open the extension's UI
 * in a side panel. Nothing renders without an extension.
 */
export const ExtensionActions: React.FC<{
  page: ExtensionActionDef['page'];
  record: ExtensionMountRecord;
  /** The record's current state, for the action's "when" rule (status / stage / stageType). */
  state?: Partial<Record<'status' | 'stage' | 'stageType', string | null | undefined>>;
  onDone?: (message: string) => void;
  onError?: (message: string) => void;
}> = ({ page, record, state = {}, onDone, onError }) => {
  const { declarations, canUse } = useActiveExtension();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [busy, setBusy] = useState('');
  const [panel, setPanel] = useState<ExtensionActionDef | null>(null);

  const actions = (declarations.actions || []).filter((a) => {
    if (a.page !== page || !canUse(a.permission)) return false;
    return Object.entries(a.when || {}).every(([key, values]) => {
      const actual = String(state[key as 'status' | 'stage' | 'stageType'] || '').toLowerCase();
      return (values || []).some((v) => v.toLowerCase() === actual);
    });
  });
  if (!actions.length) return null;

  const run = async (action: ExtensionActionDef) => {
    if (action.kind === 'mount') {
      setPanel(action);
      return;
    }
    if (action.confirm && !(await confirm(action.confirm))) return;
    setBusy(action.id);
    try {
      const res = await crmApi.runExtensionAction(action.id, record.id);
      if (res.data?.message) onDone?.(res.data.message);
      if (res.data?.navigate) navigate(res.data.navigate);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'The action failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          data-testid={`extension-action-${action.id}`}
          disabled={Boolean(busy)}
          onClick={() => void run(action)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 cursor-pointer disabled:opacity-50 hover:bg-zinc-50"
        >
          {getExtensionIcon(action.icon, { className: 'h-3.5 w-3.5' })}
          {busy === action.id ? 'Working…' : action.label}
        </button>
      ))}
      {panel ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-label={panel.label}>
          <div className="h-full w-full max-w-xl overflow-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="m-0 text-sm font-semibold text-zinc-950">{panel.label}</h2>
              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold cursor-pointer"
                onClick={() => setPanel(null)}
              >
                Close
              </button>
            </div>
            <ExtensionMount slot={panel.slot} record={record} className="p-4" />
          </div>
        </div>
      ) : null}
    </>
  );
};
