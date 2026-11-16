import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { crmApi } from '../../services/api';
import type { QuotationItem } from '../../types/quotations';
import type { SalesFlowSummaryItem } from '../../types/leads';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { financeFieldClass } from '../../components/finance/FinanceFormElements';
import { SalesFlowSummaryStrip } from '../../components/finance/SalesFlowQuotationParts';
import { useSalesFlowConfig } from '../../hooks/useSalesFlowConfig';
import { salesTerms } from '../../utils/salesTerms';
import { displayLabel } from '../../utils/displayLabels';
import { useNotifyMessage } from '@/components/notifications';

/**
 * Create Invoice when the active extension raises invoices from an accepted quotation
 * (manifest salesFlow.invoiceFromQuotation): pick the quotation, review its services, summary and
 * money — all read-only — and create the tax invoice. The server copies the quotation's lines and
 * carries every verified payment (advance and balance) onto the invoice; nothing typed here is used.
 */
export const QuotationInvoiceCreate: React.FC<{ initialQuotationId?: string; opportunityId?: string; returnTo?: string | null }> = ({
  initialQuotationId = '',
  opportunityId = '',
  returnTo,
}) => {
  const navigate = useNavigate();
  const salesFlow = useSalesFlowConfig();
  const terms = salesTerms(salesFlow);
  const [options, setOptions] = useState<QuotationItem[]>([]);
  const [quotationId, setQuotationId] = useState(initialQuotationId);
  const [quote, setQuote] = useState<QuotationItem | null>(null);
  const [summary, setSummary] = useState<SalesFlowSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useNotifyMessage(error, 'error', () => setError(''));

  // Accepted quotations not invoiced yet.
  useEffect(() => {
    void Promise.all([
      crmApi.listQuotations({ limit: 200, status: 'Accepted' }).catch(() => ({ data: [] as QuotationItem[] })),
      crmApi.listQuotations({ limit: 200, status: 'Converted' }).catch(() => ({ data: [] as QuotationItem[] })),
    ]).then(([a, c]) => {
      const list = [...(a.data || []), ...(c.data || [])].filter((q) => !q.convertedInvoiceId);
      setOptions(list);
    });
  }, []);

  // From a won opportunity: its accepted quotation.
  useEffect(() => {
    if (initialQuotationId || !opportunityId) return;
    crmApi
      .getOpportunity(opportunityId)
      .then((res) => {
        const accepted = String((res.data as { acceptedQuotationId?: string } | undefined)?.acceptedQuotationId || '');
        if (accepted) setQuotationId(accepted);
      })
      .catch(() => {});
  }, [initialQuotationId, opportunityId]);

  const load = useCallback(async (id: string) => {
    setQuote(null);
    setSummary([]);
    setError('');
    if (!id) return;
    setLoading(true);
    try {
      const [q, s] = await Promise.all([
        crmApi.getQuotation(id),
        crmApi.getInvoicePrefill(id).catch(() => ({ data: { summary: [] as SalesFlowSummaryItem[] } })),
      ]);
      setQuote(q.data || null);
      setSummary((s.data && s.data.summary) || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The quotation could not be loaded');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(quotationId);
  }, [quotationId, load]);

  const lines = useMemo(
    () =>
      (quote?.lineItems || []).map((l) => {
        const base = (Number(l.qty) || 0) * (Number(l.rate) || 0);
        const tax = (base * (Number(l.tax) || 0)) / 100;
        return { name: l.name, description: l.description || '', base, tax, amount: base + tax };
      }),
    [quote]
  );

  const currency = quote?.currency || 'INR';
  const pay = quote?.paymentState || null;
  const grandTotal = Number(quote?.grandTotal) || 0;
  const paid = pay ? pay.paid : 0;
  const balance = pay ? Number(pay.balance) || 0 : grandTotal; // from the server's verified payments
  const discount = Number((quote as { discountTotal?: number } | null)?.discountTotal ?? quote?.discountAmount ?? 0) || 0;
  const invoiced = Boolean(quote?.convertedInvoiceId);
  const acceptable = quote ? ['Accepted', 'Converted'].includes(String(quote.status)) && !invoiced : false;

  const create = async () => {
    if (!quote || !acceptable) return;
    setSaving(true);
    setError('');
    try {
      const res = await crmApi.convertQuotationToInvoice(quote._id);
      const data = res.data as unknown as { invoice?: { _id?: string }; _id?: string };
      const id = String(data?.invoice?._id || data?._id || '');
      navigate(id ? `/invoices/${encodeURIComponent(id)}` : '/invoices');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The invoice could not be created');
      setSaving(false);
    }
  };

  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-3">
      <span className={strong ? 'font-semibold text-zinc-950' : 'text-zinc-600'}>{label}</span>
      <strong className={strong ? 'text-zinc-950' : 'font-medium text-zinc-900'}>{value}</strong>
    </div>
  );

  return (
    <div data-tour="invoices-create-form" className="flex w-full flex-col gap-5 pb-14" data-testid="quotation-invoice-create">
      <header className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
        <Link to={returnTo || '/invoices'} className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950">
          ← Invoices
        </Link>
        <h1 className="m-0 text-2xl font-bold text-zinc-950">Create Invoice</h1>
        <p className="m-0 text-sm text-zinc-500">
          Raised from an accepted quotation: its {terms.lines.toLowerCase()} and the payments already received are carried over.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-300 bg-white p-5">
        <h2 className="m-0 mb-3 text-sm font-semibold text-zinc-950">Customer / Booking</h2>
        <label className="flex max-w-xl flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-700">Accepted quotation *</span>
          <select className={financeFieldClass} value={quotationId} onChange={(e) => setQuotationId(e.target.value)} aria-label="Accepted quotation">
            <option value="">Select an accepted quotation…</option>
            {quotationId && !options.some((o) => o._id === quotationId) ? <option value={quotationId}>{quote?.quotationNo || 'Selected quotation'}</option> : null}
            {options.map((o) => (
              <option key={o._id} value={o._id}>
                {displayLabel(o.quotationNo, o.quotationNumber, o.number)} · {displayLabel(o.recipientName, o.clientName, o.customerName, o.customerLabel)}
              </option>
            ))}
          </select>
          {!options.length ? <span className="text-[11px] text-zinc-500">No accepted quotation is waiting for an invoice.</span> : null}
        </label>
        {quote ? (
          <p className="m-0 mt-3 text-sm text-zinc-700">
            Billed to <strong>{displayLabel(quote.recipientName, quote.clientName, quote.customerName, quote.customerLabel)}</strong>
            {quote.title ? ` · ${quote.title}` : ''}
          </p>
        ) : null}
      </section>

      {loading ? <div className="rounded-xl border border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Loading quotation…</div> : null}

      {quote && !loading ? (
        <>
          {summary.length ? <SalesFlowSummaryStrip title={salesFlow.quotationSummaryTitle || 'Summary'} items={summary} showLabels /> : null}

          <section className="rounded-xl border border-zinc-300 bg-white p-5" data-testid="invoice-services">
            <h2 className="m-0 mb-1 text-sm font-semibold text-zinc-950">{terms.lines}</h2>
            <p className="m-0 mb-3 text-xs text-zinc-500">From quotation {quote.quotationNo}; the prices are the ones the customer accepted.</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lines.map((l, i) => (
                <li key={`${l.name}-${i}`} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-zinc-950 break-words">{l.name}</div>
                    {l.description ? <div className="mt-0.5 text-xs text-zinc-600 break-words whitespace-pre-line">{l.description}</div> : null}
                  </div>
                  <dl className="m-0 grid grid-cols-3 gap-x-5 text-right text-[13px]">
                    <div>
                      <dt className="text-[11px] text-zinc-500">Rate</dt>
                      <dd className="m-0 font-medium tabular-nums text-zinc-900">{formatFinanceMoney(l.base, currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">Tax</dt>
                      <dd className="m-0 font-medium tabular-nums text-zinc-900">{formatFinanceMoney(l.tax, currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-zinc-500">Amount</dt>
                      <dd className="m-0 font-semibold tabular-nums text-zinc-950">{formatFinanceMoney(l.amount, currency)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-300 bg-white p-5" data-testid="invoice-commercial-summary">
            <h2 className="m-0 mb-3 text-sm font-semibold text-zinc-950">{terms.commercialSummary}</h2>
            <div className="flex max-w-md flex-col gap-2 text-sm">
              {row(terms.subtotal, formatFinanceMoney(Number(quote.subtotal) || 0, currency))}
              {row('Tax', formatFinanceMoney(Number(quote.taxTotal) || 0, currency))}
              {discount > 0 ? row('Discount', `-${formatFinanceMoney(discount, currency)}`) : null}
              <div className="border-t border-zinc-200 pt-2">{row('Grand total', formatFinanceMoney(grandTotal, currency), true)}</div>
              {row(pay && (pay.stage === 'Advance Paid' || pay.status === 'Partially Paid') ? 'Advance paid' : 'Amount paid', formatFinanceMoney(paid, currency))}
              {row('Balance due', formatFinanceMoney(balance, currency), true)}
              {row('Currency', currency)}
            </div>
            {paid > 0 && balance <= 0.05 ? (
              <p className="m-0 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Paid in full — the invoice is created as Paid and no payment is requested.
              </p>
            ) : paid > 0 ? (
              <p className="m-0 mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                The invoice is for the full {formatFinanceMoney(grandTotal, currency)}; the {formatFinanceMoney(paid, currency)} already paid is
                carried over, so {formatFinanceMoney(balance, currency)} is due.
              </p>
            ) : null}
            {invoiced ? <p className="m-0 mt-3 text-xs font-semibold text-amber-800">This quotation already has an invoice.</p> : null}
          </section>
        </>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate(returnTo || '/invoices')}
          className="h-9 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void create()}
          disabled={!acceptable || saving}
          className="h-9 cursor-pointer rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Invoice'}
        </button>
      </div>
    </div>
  );
};

export default QuotationInvoiceCreate;
