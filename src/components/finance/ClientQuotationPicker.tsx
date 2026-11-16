import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { crmApi } from '../../services/api';
import type { ClientQuotationPickerData } from '../../types/leads';
import { useNotifyMessage } from '@/components/notifications';

interface Props {
  clientId: string;
  clientName?: string;
  onClose: () => void;
  /** The extension prepared the quotation: its lead / opportunity. */
  onStarted: (result: { leadId: string; opportunityId: string; recordId?: string }) => void;
}

/**
 * Before a quotation for a client (CRM 3.34.0, salesFlow.clientQuotation): the active extension says what
 * to choose (e.g. the travellers of the trip, at least one), then prepares the quotation's lead and
 * opportunity. Nothing about the industry is known here — the list, texts and minimum come from it.
 */
export const ClientQuotationPicker: React.FC<Props> = ({ clientId, clientName, onClose, onStarted }) => {
  const [data, setData] = useState<ClientQuotationPickerData | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  useNotifyMessage(error, 'error');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    crmApi
      .getClientQuotationPicker(clientId)
      .then((res) => {
        if (!alive) return;
        const d = res.data || null;
        setData(d);
        setChosen(new Set((d?.items || []).filter((i) => i.checked).map((i) => i.id)));
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Could not load the choices'));
    return () => {
      alive = false;
    };
  }, [clientId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const min = data?.min ?? 1;
  const enough = chosen.size >= min;

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!enough || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await crmApi.startClientQuotation(clientId, [...chosen]);
      if (res.data) onStarted(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The quotation could not be prepared');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="client-quotation-picker-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 id="client-quotation-picker-title" className="m-0 text-sm font-bold text-zinc-950">
              {data?.title || 'Choose'}
            </h3>
            {clientName ? <p className="m-0 mt-0.5 text-[11px] text-zinc-500">Client: {clientName}</p> : null}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!data && !error ? <p className="m-0 text-xs text-zinc-500">Loading…</p> : null}
          {data && data.eligible === false ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-xs text-zinc-700">{data.message || 'This client cannot get a quotation yet.'}</p>
              {data.emptyLink ? (
                <Link to={data.emptyLink.link} className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 no-underline hover:bg-zinc-50">
                  {data.emptyLink.label}
                </Link>
              ) : null}
            </div>
          ) : null}
          {data && data.eligible !== false ? (
            <div className="flex flex-col gap-3">
              {data.intro ? <p className="m-0 text-xs text-zinc-600">{data.intro}</p> : null}
              {data.items.length ? (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {data.items.map((item) => (
                    <li key={item.id}>
                      <label className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${item.disabled ? 'border-zinc-200 bg-zinc-50' : 'cursor-pointer border-zinc-200 hover:bg-zinc-50'}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4"
                          checked={chosen.has(item.id)}
                          disabled={item.disabled || busy}
                          onChange={() => toggle(item.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-zinc-900">{item.label}</span>
                          {item.detail ? <span className="block text-[11px] text-zinc-500">{item.detail}</span> : null}
                          {item.hint ? <span className="block text-[11px] text-amber-700">{item.hint}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-xs text-zinc-600">{data.emptyText || 'Nothing to choose yet.'}</p>
              )}
              {data.emptyLink ? (
                <Link to={data.emptyLink.link} className="self-start text-xs font-semibold text-zinc-900">
                  {data.emptyLink.label}
                </Link>
              ) : null}
              {!enough ? <p className="m-0 text-[11px] text-amber-700">Choose at least {min}.</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
          {data && data.eligible !== false ? (
            <button type="button" onClick={() => void submit()} disabled={!enough || busy} className="h-9 cursor-pointer rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? 'Preparing…' : data.submitLabel || 'Continue'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
