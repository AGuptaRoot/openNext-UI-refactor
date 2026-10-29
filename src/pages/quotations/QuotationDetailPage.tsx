import { displayLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LinkIcon from '@mui/icons-material/Link';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import {
  COMPANY_STATE_DEFAULT,
  type QuotationAdvanceMode,
  type QuotationItem,
  type QuotationLineItem,
  type QuotationPaymentType,
} from '../../types/quotations';
import type { InvoiceItem } from '../../types/invoices';
import { formatDocumentDate } from '../../utils/dateFormat';
import { calculateFinanceTotals } from '../../utils/financeTotals';
import { buildFullQuotationPortalLink } from '../../utils/portalLinks';
import { loadRazorpayCheckoutScript } from '../../utils/razorpayCheckout';
import { computeQuotationPayable } from '../../utils/quotationPayment';
import { getRuntimeDefaultCurrency } from '../../utils/currency';
import { triggerFileDownload } from '../../utils/fileDownload';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Sent: 'bg-sky-50 text-sky-800',
    Accepted: 'bg-emerald-50 text-emerald-800',
    Rejected: 'bg-rose-50 text-rose-800',
    Expired: 'bg-amber-50 text-amber-800',
    Converted: 'bg-indigo-50 text-indigo-800',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function quoteNo(item: QuotationItem): string {
  return displayLabel(item.quotationNo, item.quotationNumber, item.number);
}

export const QuotationDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { alert, confirm } = useDialog();
  const { hasPermission, hasAnyPermission, isClient, features } = useAuth();
  const canWriteQuotes =
    hasAnyPermission('crm.quotes.write', 'crm.finance.write') && !isClient;
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const canWriteOrders = hasPermission('crm.orders.write') && !isClient;
  const proformaEnabled = features.proformaAdvance;
  const defaultAdvancePercent = features.defaultAdvancePercent;
  const [quote, setQuote] = useState<QuotationItem | null>(null);
  const [revisions, setRevisions] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [portalLink, setPortalLink] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseReason, setReviseReason] = useState('');
  const [reviseValidTill, setReviseValidTill] = useState('');
  /**
   * A revision exists to change the numbers, so the items are editable right
   * here rather than leaving the rep with a copy they cannot touch.
   */
  const [reviseItems, setReviseItems] = useState<QuotationLineItem[]>([]);
  const [reviseDiscount, setReviseDiscount] = useState(0);
  const [reviseNotes, setReviseNotes] = useState('');

  /*
   * Proforma & advance payment (Settings → General). The payment terms live on
   * the quotation; the money is collected against a proforma raised from it.
   */
  const [proforma, setProforma] = useState<InvoiceItem | null>(null);
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [paying, setPaying] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [paymentType, setPaymentType] = useState<QuotationPaymentType>('full');
  const [advanceMode, setAdvanceMode] = useState<QuotationAdvanceMode>('percent');
  const [advanceValue, setAdvanceValue] = useState<number>(features.defaultAdvancePercent);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, rev, gateway] = await Promise.all([
        crmApi.getQuotation(id),
        crmApi.listQuotationRevisions(id).catch(() => ({ data: [] as QuotationItem[] })),
        proformaEnabled
          ? crmApi.getRazorpayStatus().catch(() => ({ data: { configured: false } }))
          : Promise.resolve({ data: { configured: false } }),
      ]);
      setQuote(detail.data);
      setRevisions(rev.data || []);
      setRazorpayConfigured(Boolean(gateway?.data?.configured));

      // Payment terms, seeded for editing; the settings default fills the gap.
      setPaymentType(detail.data.paymentType === 'advance' ? 'advance' : 'full');
      setAdvanceMode(detail.data.advanceMode === 'amount' ? 'amount' : 'percent');
      setAdvanceValue(
        Number(detail.data.advanceValue) > 0
          ? Number(detail.data.advanceValue)
          : defaultAdvancePercent
      );

      /*
       * The payment request itself, when one has been raised — it carries the
       * status, what has been paid and what is still open. A portal user is
       * allowed to read their own; anything else is simply not shown.
       */
      const proformaId = String(detail.data.proformaInvoiceId || '').trim();
      if (proformaEnabled && proformaId) {
        const found = await crmApi.getInvoice(proformaId).catch(() => null);
        setProforma(found?.data || null);
      } else {
        setProforma(null);
      }
      setPortalLink(
        buildFullQuotationPortalLink(
          detail.data.portalUrl,
          detail.data.portalToken
        )
      );
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load quotation');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [id, proformaEnabled, defaultAdvancePercent]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    if (!quote) return null;
    return calculateFinanceTotals({
      lines: quote.lineItems || [],
      discountType: quote.discountType,
      discountValue: quote.discountValue ?? quote.discountPercent ?? quote.discountAmount,
      taxCalculation: quote.taxCalculation,
      shippingCharge: quote.shippingCharge,
    });
  }, [quote]);

  const gstMode =
    quote?.gstMode ||
    (quote?.shippingState === COMPANY_STATE_DEFAULT ? 'intra' : 'inter');

  const taxTotal = quote?.taxTotal ?? totals?.taxTotal ?? 0;
  const cgst = quote?.cgst ?? (gstMode === 'intra' ? taxTotal / 2 : 0);
  const sgst = quote?.sgst ?? (gstMode === 'intra' ? taxTotal / 2 : 0);
  const igst = quote?.igst ?? (gstMode === 'inter' ? taxTotal : 0);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const sendQuote = () =>
    run(async () => {
      await crmApi.sendQuotation(id);
      await alert('Quotation marked as sent / email dispatched.');
    });

  const generatePortal = () =>
    run(async () => {
      const result = await crmApi.generateQuotationPortalToken(id);
      setPortalLink(
        buildFullQuotationPortalLink(result.data.portalUrl, result.data.portalToken)
      );
      await alert('Client portal link generated.');
    });

  const acceptQuote = () =>
    run(async () => {
      if (!(await confirm('Mark this quotation as accepted?'))) return;
      await crmApi.acceptQuotation(id);
    });

  const rejectQuote = () =>
    run(async () => {
      if (!rejectReason.trim()) throw new Error('Rejection reason is required.');
      await crmApi.rejectQuotation(id, { reason: rejectReason.trim() });
      setRejectOpen(false);
      setRejectReason('');
    });

  /** Line items as typed in the revise modal, with blank rows dropped. */
  const cleanedReviseItems = useMemo(
    () =>
      reviseItems
        .map((line) => ({
          ...line,
          name: String(line.name || '').trim(),
          description: String(line.description || '').trim(),
          qty: Number(line.qty) || 0,
          rate: Number(line.rate) || 0,
          tax: Number(line.tax) || 0,
        }))
        .filter((line) => (line.name || line.description) && line.qty > 0),
    [reviseItems]
  );

  const reviseTotals = useMemo(() => {
    const subtotal = cleanedReviseItems.reduce((sum, line) => sum + line.qty * line.rate, 0);
    const discount = Math.min(subtotal, (subtotal * Math.max(0, reviseDiscount)) / 100);
    const taxable = subtotal - discount;
    const taxTotal = cleanedReviseItems.reduce((sum, line) => {
      const base = line.qty * line.rate;
      const share = subtotal > 0 ? base / subtotal : 0;
      return sum + ((taxable * share) * line.tax) / 100;
    }, 0);
    const shipping = Number(quote?.shippingCharge || 0);
    return {
      subtotal,
      discount,
      taxTotal,
      grandTotal: Math.round((taxable + taxTotal + shipping) * 100) / 100,
      shipping,
    };
  }, [cleanedReviseItems, reviseDiscount, quote?.shippingCharge]);

  const openReviseModal = () => {
    if (!quote) return;
    setReviseReason('');
    setReviseValidTill(quote.validTill || '');
    setReviseItems(
      (quote.lineItems || []).map((line) => ({
        name: line.name || '',
        description: line.description || '',
        qty: Number(line.qty) || 1,
        rate: Number(line.rate) || 0,
        tax: Number(line.tax) || 0,
      }))
    );
    setReviseDiscount(Number(quote.discountPercent || 0));
    setReviseNotes(quote.recipientNotes || '');
    setReviseOpen(true);
  };

  const updateReviseItem = (index: number, patch: Partial<QuotationLineItem>) =>
    setReviseItems((current) =>
      current.map((line, idx) => (idx === index ? { ...line, ...patch } : line))
    );

  const reviseQuote = () =>
    run(async () => {
      if (!reviseReason.trim()) throw new Error('Revision reason is required.');
      if (!cleanedReviseItems.length) {
        throw new Error('A revision needs at least one item with a quantity.');
      }
      if (!(reviseTotals.grandTotal > 0)) {
        throw new Error('A quotation cannot total \u20b90. Set a price on at least one item.');
      }
      const created = await crmApi.reviseQuotation(id, {
        reason: reviseReason.trim(),
        validTill: reviseValidTill || undefined,
        lineItems: cleanedReviseItems,
        discountPercent: reviseDiscount,
        recipientNotes: reviseNotes,
      });
      setReviseOpen(false);
      setReviseReason('');
      setReviseValidTill('');
      setReviseItems([]);
      navigate(`/quotations/${created.data._id}`);
    });

  /** Save the payment terms. The server ignores them while the feature is off. */
  const savePaymentTerms = async () => {
    setSavingTerms(true);
    setError('');
    try {
      await crmApi.updateQuotation(id, {
        paymentType,
        advanceMode,
        advanceValue: paymentType === 'advance' ? advanceValue : 0,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the payment terms');
    } finally {
      setSavingTerms(false);
    }
  };

  /** Raise the payment request without collecting anything yet. */
  const raiseProforma = () =>
    run(async () => {
      const created = await crmApi.createQuotationProforma(id);
      await alert(
        `Proforma ${created.data?.invoiceNo || ''} raised. Send it to the client, or collect the payment here.`.trim()
      );
    });

  /**
   * Collect the payment for this quotation.
   *
   * The money goes against the proforma, which the server raises (or reuses)
   * as part of creating the order — so this screen never has to decide whether
   * a payment request already exists.
   */
  const payQuotation = async () => {
    if (!quote) return;
    setPaying(true);
    setError('');
    try {
      const orderRes = await crmApi.createQuotationRazorpayOrder(id, {
        currency: quote.currency,
      });
      const payload = orderRes.data || ({} as any);
      const order = payload.order || {};
      const keyId = payload.keyId || order.key_id;
      const proformaId = String(payload.proformaId || '');
      if (!keyId || !order.id || !proformaId) {
        throw new Error('Could not create the payment order. Check the gateway configuration.');
      }

      await loadRazorpayCheckoutScript();

      await new Promise<void>((resolve, reject) => {
        const options = {
          key: keyId,
          amount: Number(order.amount || payload.amount),
          currency: String(
            order.currency || payload.currency || quote.currency || getRuntimeDefaultCurrency()
          ),
          name: payload.businessName || 'Quotation Payment',
          description: payload.isAdvance
            ? `Advance against ${quoteNo(quote)}`
            : `Payment for ${quoteNo(quote)}`,
          order_id: order.id,
          prefill: {
            name:
              quote.recipientName || quote.clientName || quote.customerName || quote.customerLabel || '',
            email: quote.acceptedByEmail || '',
            contact: '',
          },
          notes: {
            quotationId: String(quote._id),
            quotationNo: String(quoteNo(quote)),
            proformaId,
            proformaNo: String(payload.proformaNo || ''),
          },
          theme: { color: '#0f172a' },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // The proforma is an invoice, so the ordinary confirm path
              // records the payment and runs auto-accept when it is switched on.
              const confirmRes = await crmApi.confirmInvoiceRazorpayPayment(proformaId, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await alert(confirmRes.message || 'Payment recorded successfully.');
              await load();
              resolve();
            } catch (err: any) {
              const msg = err instanceof Error ? err.message : 'Payment verification failed';
              setError(msg);
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              resolve();
            },
          },
        };
        const checkout = new (window as any).Razorpay(options);
        checkout.on('payment.failed', (failure: any) => {
          setError(failure?.error?.description || 'The payment failed. Nothing was charged.');
          resolve();
        });
        checkout.open();
      });
    } catch (reason: any) {
      if (reason?.message && reason.message !== 'Payment cancelled') {
        setError(reason.message || 'The payment could not be started');
      }
    } finally {
      setPaying(false);
    }
  };

  const convertInvoice = () =>
    run(async () => {
      const invoice = await crmApi.convertQuotationToInvoice(id);
      await alert('Converted to invoice.');
      navigate(`/invoices/${invoice.data._id}`);
    });

  const convertSalesOrder = () =>
    run(async () => {
      const order = await crmApi.convertQuotationToSalesOrder(id);
      await alert('Converted to sales order.');
      if (order.data?._id) navigate(`/sales-orders/${order.data._id}`);
    });

  const printQuote = () => {
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Pop-up blocked. Allow pop-ups for this site to print quotations.');
      return;
    }
    popup.document.write(
      '<!doctype html><html><head><title>Preparing print…</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#52525b">Preparing quotation print view…</body></html>'
    );
    popup.document.close();

    run(async () => {
      try {
        const result = await crmApi.getQuotationPrintHtml(id);
        const html = result.data?.html;
        if (!html) throw new Error('Print view returned no content');
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.setTimeout(() => {
          try {
            popup.print();
          } catch {
            // ignore
          }
        }, 250);
      } catch (reason) {
        try {
          popup.close();
        } catch {
          // ignore
        }
        throw reason;
      }
    });
  };

  const downloadPdf = () =>
    run(async () => {
      const blob = await crmApi.downloadQuotationPdf(id);
      const filename = `${quoteNo(quote!) || 'quotation'}.pdf`;
      const pdfBlob = blob.type.includes('pdf')
        ? blob
        : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
      const ok = triggerFileDownload({
        filename,
        content: pdfBlob,
        mimeType: 'application/pdf',
        format: 'pdf',
      });
      if (!ok) {
        throw new Error('Could not start the PDF download in this browser.');
      }
    });

  if (loading) {
    return <div className="p-12 text-center text-sm text-zinc-500">Loading quotation…</div>;
  }

  if (!quote) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500 mb-4">{error || 'Quotation not found.'}</p>
        <Link to="/quotations" className="text-sm font-semibold text-zinc-950">
          ← Back to quotations
        </Link>
      </div>
    );
  }

  const locked = ['Converted'].includes(quote.status) || quote.isArchived;
  // Only the client portal user can accept or reject quotations (admin / staff must not).
  // Quotations must be in 'Sent' status to be accepted or rejected (Drafts cannot be accepted/rejected).
  const canDecideQuote = isClient;
  const canAccept = canDecideQuote && quote.status === 'Sent' && !locked;
  const canReject = canDecideQuote && quote.status === 'Sent' && !locked;
  const canRevise = canWriteQuotes && !locked && ['Rejected', 'Sent', 'Expired'].includes(quote.status);
  const canConvertInvoice =
    canWriteFinance &&
    ['Accepted', 'Sent'].includes(quote.status) &&
    !quote.convertedInvoiceId &&
    !quote.convertedSalesOrderId;
  const canConvertSalesOrder =
    canWriteOrders &&
    ['Accepted', 'Sent'].includes(quote.status) &&
    !quote.convertedInvoiceId &&
    !quote.convertedSalesOrderId;

  /* ------------------------------------------- proforma & advance payment */
  const payableNow = computeQuotationPayable(
    { grandTotal: quote.grandTotal, paymentType, advanceMode, advanceValue },
    defaultAdvancePercent
  );
  const termsEditable = canWriteQuotes && quote.status === 'Draft' && !quote.isArchived;
  const termsDirty =
    paymentType !== (quote.paymentType === 'advance' ? 'advance' : 'full') ||
    (paymentType === 'advance' &&
      (advanceMode !== (quote.advanceMode === 'amount' ? 'amount' : 'percent') ||
        Number(advanceValue) !== Number(quote.advanceValue || 0)));
  // A payment request that is still open: not converted, not cancelled, owing.
  const proformaOpen = Boolean(
    proforma &&
      !proforma.convertedInvoiceId &&
      proforma.status !== 'Cancelled' &&
      Number(proforma.balanceDue ?? proforma.grandTotal) > 0
  );
  const payableQuoteStatus = !['Rejected', 'Expired'].includes(String(quote.status));
  const canPayQuote =
    proformaEnabled &&
    razorpayConfigured &&
    Number(quote.grandTotal) > 0 &&
    !locked &&
    payableQuoteStatus &&
    !quote.convertedInvoiceId &&
    (proforma ? proformaOpen : true) &&
    (isClient || hasAnyPermission('crm.finance.read', 'crm.finance.write'));
  const canRaiseProforma =
    proformaEnabled &&
    canWriteFinance &&
    !proforma &&
    !locked &&
    payableQuoteStatus &&
    Number(quote.grandTotal) > 0;

  return (
    <div data-tour="quotations-detail" className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <Link
            to="/quotations"
            className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950"
          >
            ← Quotations
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-950 m-0">{quoteNo(quote)}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                quote.status
              )}`}
            >
              {quote.status}
            </span>
            {quote.status === 'Sent' && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                Read-only
              </span>
            )}
            {quote.status === 'Accepted' && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Locked
              </span>
            )}
            {quote.status === 'Rejected' && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                Read-only
              </span>
            )}
            {quote.isArchived && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600">
                Archived
              </span>
            )}
            {quote.revisionNumber != null && quote.revisionNumber > 0 && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-violet-50 text-violet-800">
                R{quote.revisionNumber}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {quote.recipientName || quote.clientName || quote.customerName || quote.customerLabel || '—'}
            {quote.opportunityTitle ? ` · ${quote.opportunityTitle}` : ''}
            {quote.title ? ` · ${quote.title}` : ''}
          </p>
        </div>
        <div data-tour="quotations-detail-actions" className="flex flex-wrap gap-2">
          {canWriteQuotes && quote.status === 'Draft' && !quote.isArchived && (
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate(`/quotations/${id}/edit`)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:bg-zinc-100"
            >
              <EditIcon sx={{ fontSize: 15 }} /> Edit
            </button>
          )}
          {canWriteQuotes && quote.status === 'Draft' && !quote.isArchived && (
            <button
              type="button"
              disabled={busy || locked}
              onClick={sendQuote}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-950 bg-zinc-950 text-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50 hover:bg-zinc-800"
            >
              <SendIcon sx={{ fontSize: 15 }} /> Send to Client
            </button>
          )}
          {canWriteQuotes && quote.status !== 'Draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={generatePortal}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <LinkIcon sx={{ fontSize: 15 }} /> Portal token
            </button>
          )}
          {canAccept && (
            <button
              type="button"
              disabled={busy}
              onClick={acceptQuote}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 cursor-pointer disabled:opacity-50"
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 15 }} /> Accept
            </button>
          )}
          {canReject && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 cursor-pointer disabled:opacity-50"
            >
              <CancelOutlinedIcon sx={{ fontSize: 15 }} /> Reject
            </button>
          )}
          {canRevise && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                openReviseModal();
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-900 cursor-pointer disabled:opacity-50 hover:bg-violet-100"
            >
              <HistoryIcon sx={{ fontSize: 15 }} /> Revise Quotation
            </button>
          )}
          {canConvertInvoice && (
            <button
              type="button"
              disabled={busy}
              onClick={convertInvoice}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-900 cursor-pointer disabled:opacity-50"
            >
              <ReceiptLongIcon sx={{ fontSize: 15 }} /> Convert to Invoice
            </button>
          )}
          {canConvertSalesOrder && (
            <button
              type="button"
              disabled={busy}
              onClick={convertSalesOrder}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-900 cursor-pointer disabled:opacity-50"
            >
              <LocalShippingIcon sx={{ fontSize: 15 }} /> Convert to Sales Order
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={printQuote}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <PrintIcon sx={{ fontSize: 15 }} /> Print
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={downloadPdf}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <PictureAsPdfIcon sx={{ fontSize: 15 }} /> PDF
          </button>
          {canWriteQuotes &&
            (quote.isArchived ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => crmApi.restoreQuotation(id))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <UnarchiveIcon sx={{ fontSize: 15 }} /> Restore
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => crmApi.archiveQuotation(id))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <ArchiveIcon sx={{ fontSize: 15 }} /> Archive
              </button>
            ))}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {canWriteQuotes && portalLink && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-2xs">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-sky-900">
              Client Portal Link
            </div>
            <p className="m-0 mt-0.5 text-xs text-sky-700">
              Share this secure portal link with the client to review, download PDF, or accept the quotation online.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-900 hover:bg-sky-50 cursor-pointer transition-colors shadow-2xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(portalLink);
                  await alert('Client portal link copied to clipboard!');
                } catch {
                  const el = document.createElement('textarea');
                  el.value = portalLink;
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand('copy');
                  document.body.removeChild(el);
                  await alert('Client portal link copied to clipboard!');
                }
              }}
            >
              Copy Link
            </button>
            <a
              href={portalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 text-white hover:bg-sky-700 px-3 text-xs font-semibold no-underline transition-colors shadow-2xs"
            >
              Open Portal
            </a>
          </div>
        </div>
      )}

      {(quote.convertedInvoiceId || quote.convertedSalesOrderId) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 flex flex-wrap gap-4">
          {quote.convertedInvoiceId && (
            <Link to={`/invoices/${quote.convertedInvoiceId}`} className="font-semibold no-underline text-indigo-900">
              Open converted invoice →
            </Link>
          )}
          {quote.convertedSalesOrderId && (
            <Link
              to={`/sales-orders/${quote.convertedSalesOrderId}`}
              className="font-semibold no-underline text-indigo-900"
            >
              Open converted sales order →
            </Link>
          )}
        </div>
      )}

      {/*
        Payment & advance. Hidden entirely unless the tenant turned on
        Settings → General → Proforma & Advance Payment, so nothing changes for
        anyone who does not use it.
      */}
      {proformaEnabled && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-semibold">Payment terms</h2>
            <p className="m-0 mb-3 text-xs text-zinc-500">
              {termsEditable
                ? 'How much the client is asked to pay up front. Editable while the quotation is a draft.'
                : 'Set while the quotation was a draft. Create a revision to change it.'}
            </p>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: 'full' as QuotationPaymentType, label: 'Full payment' },
                  { value: 'advance' as QuotationPaymentType, label: 'Advance' },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!termsEditable || savingTerms}
                  onClick={() => setPaymentType(option.value)}
                  className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    paymentType === option.value
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  } ${termsEditable ? 'cursor-pointer' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {paymentType === 'advance' && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                  {(
                    [
                      { value: 'percent' as QuotationAdvanceMode, label: 'Percentage' },
                      { value: 'amount' as QuotationAdvanceMode, label: 'Fixed amount' },
                    ]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!termsEditable || savingTerms}
                      onClick={() => setAdvanceMode(option.value)}
                      className={`h-7 rounded-md border-0 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                        advanceMode === option.value
                          ? 'bg-zinc-950 text-white'
                          : 'bg-transparent text-zinc-600'
                      } ${termsEditable ? 'cursor-pointer' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">
                    {advanceMode === 'percent' ? 'Advance %' : `Advance (${quote.currency})`}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={advanceMode === 'percent' ? 100 : undefined}
                    disabled={!termsEditable || savingTerms}
                    value={advanceValue}
                    onChange={(event) => setAdvanceValue(Number(event.target.value) || 0)}
                    className="h-9 w-36 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
              {payableNow.error ? (
                <p className="m-0 font-semibold text-amber-800">{payableNow.error}</p>
              ) : (
                <>
                  <p className="m-0 text-zinc-700">
                    Payable now{' '}
                    <strong className="text-zinc-950">
                      {formatFinanceMoney(payableNow.amount, quote.currency)}
                    </strong>{' '}
                    of {formatFinanceMoney(payableNow.total, quote.currency)}
                  </p>
                  {payableNow.isAdvance && (
                    <p className="m-0 mt-0.5 text-zinc-500">
                      Balance {formatFinanceMoney(payableNow.balance, quote.currency)}, invoiced
                      with the tax invoice once the work is delivered.
                    </p>
                  )}
                </>
              )}
            </div>

            {termsEditable && (
              <button
                type="button"
                disabled={savingTerms || busy || !termsDirty || Boolean(payableNow.error)}
                onClick={() => void savePaymentTerms()}
                className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border-0 bg-zinc-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTerms ? 'Saving…' : 'Save payment terms'}
              </button>
            )}

            {features.quotationAutoAcceptOnPayment && (
              <p className="m-0 mt-3 text-[11px] text-zinc-500">
                A successful payment also accepts this quotation, which marks the opportunity Won.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-300 bg-white p-5">
            <h2 className="m-0 mb-1 text-sm font-semibold">Payment request</h2>
            {proforma ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link
                    to={`/invoices/${proforma._id}`}
                    className="text-sm font-bold text-zinc-950 no-underline hover:underline"
                  >
                    {proforma.invoiceNo}
                  </Link>
                  <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-900">
                    Proforma
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                      proforma.status
                    )}`}
                  >
                    {proforma.status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase text-zinc-500">Requested</dt>
                    <dd className="m-0 font-medium">
                      {formatFinanceMoney(proforma.grandTotal, proforma.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-zinc-500">Received</dt>
                    <dd className="m-0 font-medium">
                      {formatFinanceMoney(proforma.amountPaid || 0, proforma.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-zinc-500">Still due</dt>
                    <dd className="m-0 font-medium">
                      {formatFinanceMoney(
                        proforma.balanceDue ?? proforma.grandTotal,
                        proforma.currency
                      )}
                    </dd>
                  </div>
                  {proforma.convertedInvoiceId && (
                    <div>
                      <dt className="text-[11px] uppercase text-zinc-500">Tax invoice</dt>
                      <dd className="m-0 font-medium">
                        <Link
                          to={`/invoices/${proforma.convertedInvoiceId}`}
                          className="text-zinc-950 no-underline hover:underline"
                        >
                          {proforma.convertedInvoiceNo || 'Open'}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
                {!proformaOpen && !proforma.convertedInvoiceId && (
                  <p className="m-0 mt-3 text-xs text-emerald-800">
                    Paid in full. A tax invoice is raised from the proforma when the work is
                    delivered.
                  </p>
                )}
              </>
            ) : (
              <p className="m-0 mt-2 text-xs text-zinc-500">
                No payment request has been raised yet. One is created automatically the first time
                this quotation is paid.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {canPayQuote && (
                <button
                  type="button"
                  disabled={busy || paying}
                  onClick={() => void payQuotation()}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CreditCardIcon sx={{ fontSize: 15 }} />
                  {paying
                    ? 'Opening Razorpay…'
                    : `Pay ${formatFinanceMoney(
                        proforma ? (proforma.balanceDue ?? proforma.grandTotal) : payableNow.amount,
                        quote.currency
                      )} now`}
                </button>
              )}
              {canRaiseProforma && (
                <button
                  type="button"
                  disabled={busy || Boolean(payableNow.error)}
                  onClick={raiseProforma}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RequestQuoteIcon sx={{ fontSize: 15 }} /> Raise proforma
                </button>
              )}
              {proformaEnabled && !razorpayConfigured && !isClient && (
                <p className="m-0 text-xs text-zinc-500">
                  Online payment needs Razorpay connected in Payment Gateway settings. A proforma
                  can still be raised and paid offline.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Grand total', value: formatFinanceMoney(quote.grandTotal, quote.currency) },
          {
            label: 'Tax total',
            value: formatFinanceMoney(taxTotal, quote.currency),
          },
          {
            label: 'GST mode',
            value: gstMode === 'intra' ? 'Intra (CGST+SGST)' : 'Inter (IGST)',
          },
          {
            label: 'Valid till',
            value: formatDocumentDate(quote.validTill || quote.expiryDate),
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      <div data-tour="quotations-detail-sections" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-zinc-300 bg-white p-5">
          <h2 className="text-sm font-semibold m-0 mb-3">Quotation details</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm m-0">
            <div>
              <dt className="text-[11px] uppercase text-zinc-500">Issue date</dt>
              <dd className="m-0 font-medium">{formatDocumentDate(quote.issueDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-zinc-500">Valid till</dt>
              <dd className="m-0 font-medium">
                {formatDocumentDate(quote.validTill || quote.expiryDate)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-zinc-500">Currency</dt>
              <dd className="m-0 font-medium">{quote.currency}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-zinc-500">Tax calc</dt>
              <dd className="m-0 font-medium">{quote.taxCalculation}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-zinc-500">Recipient type</dt>
              <dd className="m-0 font-medium capitalize">{quote.recipientType}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-zinc-500">Shipping state</dt>
              <dd className="m-0 font-medium">{quote.shippingState}</dd>
            </div>
            {quote.description && (
              <div className="col-span-2">
                <dt className="text-[11px] uppercase text-zinc-500">Description</dt>
                <dd className="m-0 whitespace-pre-wrap">{quote.description}</dd>
              </div>
            )}
            {quote.rejectionReason && (
              <div className="col-span-2">
                <dt className="text-[11px] uppercase text-zinc-500">Rejection reason</dt>
                <dd className="m-0">{quote.rejectionReason}</dd>
              </div>
            )}
            {quote.acceptedByName && (
              <div className="col-span-2">
                <dt className="text-[11px] uppercase text-zinc-500">Accepted by</dt>
                <dd className="m-0">
                  {quote.acceptedByName}
                  {quote.acceptedByEmail ? ` · ${quote.acceptedByEmail}` : ''}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-300 bg-white p-5">
          <h2 className="text-sm font-semibold m-0 mb-3">Totals & GST</h2>
          {totals && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <strong>{formatFinanceMoney(totals.subtotal, quote.currency)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <strong>-{formatFinanceMoney(totals.discount, quote.currency)}</strong>
              </div>
              {gstMode === 'intra' ? (
                <>
                  <div className="flex justify-between">
                    <span>CGST</span>
                    <strong>{formatFinanceMoney(cgst, quote.currency)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST</span>
                    <strong>{formatFinanceMoney(sgst, quote.currency)}</strong>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>IGST</span>
                  <strong>{formatFinanceMoney(igst, quote.currency)}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax total</span>
                <strong>{formatFinanceMoney(taxTotal, quote.currency)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <strong>{formatFinanceMoney(totals.shippingCharge, quote.currency)}</strong>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
                <span>Grand total</span>
                <strong>{formatFinanceMoney(quote.grandTotal ?? totals.grandTotal, quote.currency)}</strong>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 text-sm font-semibold">Line items</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Tax %</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(quote.lineItems || []).map((line, index) => (
                <tr key={`${line.name}-${index}`} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{line.name}</div>
                    {line.description && (
                      <div className="text-xs text-zinc-500">{line.description}</div>
                    )}
                    {line.fileUrl && !/amazonaws\.com/i.test(String(line.fileUrl)) && (
                      <a
                        href={line.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-700"
                      >
                        View attachment
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{line.qty}</td>
                  <td className="px-4 py-3 text-right">
                    {formatFinanceMoney(line.rate, quote.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">{line.tax}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatFinanceMoney(line.amount ?? line.qty * line.rate, quote.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {quote.recipientNotes && (
        <section className="rounded-xl border border-zinc-300 bg-white p-5">
          <h2 className="text-sm font-semibold m-0 mb-2">Recipient notes</h2>
          <p className="m-0 text-sm whitespace-pre-wrap text-zinc-700">{quote.recipientNotes}</p>
        </section>
      )}

      <section className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 text-sm font-semibold">
          Revision history
        </div>
        {revisions.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No revisions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left">Quotation</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Reason</th>
                  <th className="px-4 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((rev) => (
                  <tr key={rev._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <Link
                        to={`/quotations/${rev._id}`}
                        className="font-semibold text-zinc-950 no-underline hover:underline"
                      >
                        {quoteNo(rev)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                          rev.status
                        )}`}
                      >
                        {rev.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatFinanceMoney(rev.grandTotal, rev.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {rev.revisionReason || '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {rev.createdAt ? new Date(rev.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="m-0 text-lg font-bold">Reject quotation</h3>
            <p className="mt-2 mb-3 text-sm text-zinc-500">A reason is required for the audit trail.</p>
            <textarea
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this proposal declined?"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={rejectQuote}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}

      {reviseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="m-0 text-lg font-bold">Revise Quotation</h3>
            <p className="mt-2 mb-3 text-sm text-zinc-500">
              Creates a new revision as <strong>Draft</strong> (e.g. {quote?.quotationNo || 'QT'}-R{(quote?.revisionNumber || 0) + 1}). The new draft can be edited before sending, while this version remains preserved.
            </p>
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">
                Revision reason *
              </span>
              <textarea
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
                value={reviseReason}
                onChange={(e) => setReviseReason(e.target.value)}
                placeholder="Client requested scope / rate changes…"
              />
            </label>
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">
                New valid till
              </span>
              <input
                type="date"
                className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                value={reviseValidTill}
                onChange={(e) => setReviseValidTill(e.target.value)}
              />
            </label>

            <div className="mb-3 rounded-lg border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase text-zinc-600">
                  Items on this revision
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setReviseItems((current) => [
                      ...current,
                      { name: '', description: '', qty: 1, rate: 0, tax: 0 },
                    ])
                  }
                  className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-[11px] font-semibold cursor-pointer hover:bg-zinc-50"
                >
                  + Add item
                </button>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {reviseItems.map((line, index) => (
                  <div
                    key={`revise-line-${index}`}
                    className="grid grid-cols-12 items-center gap-2"
                  >
                    <input
                      className="col-span-5 h-9 rounded-lg border border-zinc-200 px-2 text-sm"
                      placeholder="Item"
                      value={line.name || line.description || ''}
                      onChange={(e) =>
                        updateReviseItem(index, { name: e.target.value, description: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      className="col-span-2 h-9 rounded-lg border border-zinc-200 px-2 text-sm"
                      placeholder="Qty"
                      value={line.qty}
                      onChange={(e) => updateReviseItem(index, { qty: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      min={0}
                      className="col-span-2 h-9 rounded-lg border border-zinc-200 px-2 text-sm"
                      placeholder="Rate"
                      value={line.rate}
                      onChange={(e) => updateReviseItem(index, { rate: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="col-span-2 h-9 rounded-lg border border-zinc-200 px-2 text-sm"
                      placeholder="Tax %"
                      value={line.tax}
                      onChange={(e) => updateReviseItem(index, { tax: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() =>
                        setReviseItems((current) => current.filter((_, idx) => idx !== index))
                      }
                      className="col-span-1 h-9 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-500 cursor-pointer hover:bg-zinc-50"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!reviseItems.length ? (
                  <p className="m-0 text-xs text-zinc-500">
                    No items yet — add at least one before creating the revision.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">
                  Discount %
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                  value={reviseDiscount}
                  onChange={(e) => setReviseDiscount(Number(e.target.value))}
                />
              </label>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="font-semibold">
                    {formatFinanceMoney(reviseTotals.subtotal, quote.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tax</span>
                  <span className="font-semibold">
                    {formatFinanceMoney(reviseTotals.taxTotal, quote.currency)}
                  </span>
                </div>
                {reviseTotals.shipping > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Shipping</span>
                    <span className="font-semibold">
                      {formatFinanceMoney(reviseTotals.shipping, quote.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1">
                  <span className="font-semibold text-zinc-700">New total</span>
                  <span className="font-bold text-zinc-950">
                    {formatFinanceMoney(reviseTotals.grandTotal, quote.currency)}
                  </span>
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1 mb-3">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">
                Notes for the client
              </span>
              <textarea
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                rows={2}
                value={reviseNotes}
                onChange={(e) => setReviseNotes(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviseOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !(reviseTotals.grandTotal > 0)}
                title={
                  reviseTotals.grandTotal > 0
                    ? 'Create the revised quotation'
                    : 'A quotation cannot total \u20b90'
                }
                onClick={reviseQuote}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                Create Draft Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
