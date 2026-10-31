import { displayLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SendIcon from '@mui/icons-material/Send';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LinkIcon from '@mui/icons-material/Link';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { useDialog } from '../../context/DialogContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import type { InvoiceItem, InvoicePaymentRecord } from '../../types/invoices';
import { calculateFinanceTotals } from '../../utils/financeTotals';
import { canShowInvoiceRazorpayPay } from '../../utils/permissions';
import { buildFullInvoicePortalLink } from '../../utils/portalLinks';
import { loadRazorpayCheckoutScript } from '../../utils/razorpayCheckout';
import { getRuntimeDefaultCurrency } from '../../utils/currency';
import { CreditCard } from 'lucide-react';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Sent: 'bg-sky-50 text-sky-800',
    Viewed: 'bg-indigo-50 text-indigo-800',
    'Partially Paid': 'bg-amber-50 text-amber-800',
    Paid: 'bg-emerald-50 text-emerald-800',
    Overdue: 'bg-red-50 text-red-800',
    'Written Off': 'bg-stone-100 text-stone-700',
    Cancelled: 'bg-rose-50 text-rose-800',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

export const InvoiceDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isClient, user, activeRole } = useAuth();
  const { showProjects } = useActiveExtension();
  const { alert, confirm } = useDialog();
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const [invoice, setInvoice] = useState<InvoiceItem | null>(null);
  const [payments, setPayments] = useState<InvoicePaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [payingWithRazorpay, setPayingWithRazorpay] = useState(false);
  const [portalLink, setPortalLink] = useState('');
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [salesOrderDelivered, setSalesOrderDelivered] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [inv, pays, razorpayStatus] = await Promise.all([
        crmApi.getInvoice(id),
        crmApi.listInvoicePayments(id),
        crmApi.getRazorpayStatus().catch(() => ({ success: false, data: { configured: false } })),
      ]);
      setInvoice(inv.data);
      setPayments(pays.data || []);
      setRazorpayConfigured(Boolean(razorpayStatus?.data?.configured));
      let isSoDelivered = Boolean(
        inv.data?.isSalesOrderDelivered ||
        inv.data?.salesOrderDeliveryStatus === 'Delivered'
      );
      if (!isSoDelivered && inv.data?.salesOrderId) {
        try {
          const soRes = await crmApi.getSalesOrder(inv.data.salesOrderId);
          if (soRes?.data?.deliveryStatus === 'Delivered' || (soRes?.data as any)?.status === 'Delivered') {
            isSoDelivered = true;
          }
        } catch {
          // non-blocking
        }
      }
      setSalesOrderDelivered(isSoDelivered);
      const fullUrl = buildFullInvoicePortalLink(
        inv.data.portalUrl || (inv.data as any).payUrl,
        inv.data.payToken
      );
      setPortalLink(fullUrl);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load invoice');
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    if (!invoice) return null;
    return calculateFinanceTotals({
      lines: invoice.lineItems || [],
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      taxCalculation: invoice.taxCalculation,
      shippingCharge: invoice.shippingCharge,
      amountPaid: invoice.amountPaid,
      creditAmount: invoice.creditAmount,
    });
  }, [invoice]);

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

  const sendInvoice = () =>
    run(async () => {
      await crmApi.sendInvoice(id);
      await alert('Invoice marked as sent / email dispatched.');
    });

  const generatePortal = () =>
    run(async () => {
      const result = await crmApi.generateInvoicePayToken(id);
      const fullUrl = buildFullInvoicePortalLink(
        result.data.portalUrl || (result.data as any).payUrl,
        result.data.payToken
      );
      setPortalLink(fullUrl);
      await alert('Client payment portal link generated.');
    });

  const printInvoice = () => {
    // Open synchronously on click so browsers don't treat it as a blocked pop-up.
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Pop-up blocked. Allow pop-ups for this site to print invoices.');
      return;
    }
    popup.document.write(
      '<!doctype html><html><head><title>Preparing print…</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#52525b">Preparing invoice print view…</body></html>'
    );
    popup.document.close();

    run(async () => {
      try {
        const result = await crmApi.getInvoicePrintHtml(id);
        const html = result.data?.html;
        if (!html) throw new Error('Print view returned no content');
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        // Delay print slightly so layout/styles settle in the new document.
        popup.setTimeout(() => {
          try {
            popup.print();
          } catch {
            // User can still print manually from the opened window.
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
      const blob = await crmApi.downloadInvoicePdf(id);
      const isPdf = blob.type.includes('pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoiceNo || 'invoice'}.${isPdf ? 'pdf' : 'html'}`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const handlePayWithRazorpay = async () => {
    if (!id || !invoice) return;
    setPayingWithRazorpay(true);
    setError('');

    try {
      const balanceToPay = Math.round(Number(invoice.balanceDue ?? invoice.grandTotal ?? 0) * 100) / 100;
      const orderRes = await crmApi.createInvoiceRazorpayOrder(id, {
        amount: balanceToPay,
      });
      const payload = orderRes.data || ({} as any);
      const order = payload.order || {};
      const keyId = payload.keyId || order.key_id;
      if (!keyId || !order.id) {
        throw new Error('Could not create Razorpay order. Check gateway configuration.');
      }

      await loadRazorpayCheckoutScript();

      await new Promise<void>((resolve, reject) => {
        const options = {
          key: keyId,
          amount: Number(order.amount || payload.amount),
          currency: String(
            order.currency || payload.currency || invoice.currency || getRuntimeDefaultCurrency()
          ),
          name: payload.businessName || 'Invoice Payment',
          description: `Invoice ${invoice.invoiceNo}`,
          order_id: order.id,
          prefill: {
            name: invoice.clientName || '',
            email: (invoice as any).customerEmail || (invoice as any).clientEmail || '',
            contact: (invoice as any).customerPhone || (invoice as any).clientPhone || '',
          },
          notes: {
            invoiceId: String(invoice._id),
            invoiceNo: String(invoice.invoiceNo || ''),
          },
          theme: { color: '#0f172a' },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const confirmRes = await crmApi.confirmInvoiceRazorpayPayment(invoice._id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await alert(confirmRes.message || 'Payment recorded successfully via Razorpay!');
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

        const RazorpayClass = (window as any).Razorpay;
        if (!RazorpayClass) {
          throw new Error('Razorpay checkout SDK could not be loaded.');
        }
        const rzp = new RazorpayClass(options);
        rzp.on('payment.failed', (event: any) => {
          const reason = event?.error?.description || event?.error?.reason || 'Payment failed';
          setError(reason);
          reject(new Error(reason));
        });
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message && err.message !== 'Payment cancelled') {
        setError(err.message || 'Razorpay payment failed');
      }
    } finally {
      setPayingWithRazorpay(false);
    }
  };

  /**
   * Raise the tax invoice from this proforma.
   *
   * Deliberately a button and not an automatic step: the tax invoice records
   * the supply, so a person decides when the supply has happened. The advance
   * already collected moves onto the new invoice.
   */
  const convertProforma = () =>
    run(async () => {
      const created = await crmApi.convertProformaInvoice(id);
      const taxInvoice = created.data?.invoice;
      await alert(
        `Tax invoice ${taxInvoice?.invoiceNo || ''} raised. The advance paid has been carried across.`.trim()
      );
      if (taxInvoice?._id) navigate(`/invoices/${taxInvoice._id}`);
    });

  const writeOff = () =>
    run(async () => {
      if (!writeOffReason.trim()) throw new Error('Write-off reason is required.');
      await crmApi.writeOffInvoice(id, { reason: writeOffReason.trim() });
      setWriteOffOpen(false);
      setWriteOffReason('');
    });

  if (loading) {
    return <div className="p-12 text-center text-sm text-zinc-500">Loading invoice…</div>;
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500 mb-4">{error || 'Invoice not found.'}</p>
        <Link to="/invoices" className="text-sm font-semibold text-zinc-950">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const readOnly = ['Cancelled', 'Written Off'].includes(invoice.status) || invoice.isArchived;
  /*
   * A proforma is a payment request raised from a quotation — not a tax
   * document. It keeps its own numbering and stays out of tax reporting until
   * it is converted.
   */
  const isProforma = invoice.documentType === 'proforma';
  const canConvertProforma = isProforma && canWriteFinance && !invoice.convertedInvoiceId;
  const isSalesOrderDelivered = Boolean(
    invoice.isSalesOrderDelivered ||
    invoice.salesOrderDeliveryStatus === 'Delivered' ||
    salesOrderDelivered
  );
  const canPayWithRazorpay = canShowInvoiceRazorpayPay({
    user,
    activeRole,
    isClient,
    invoice: {
      clientId: invoice.clientId,
      customerEmail: invoice.customerEmail,
      clientEmail: invoice.clientEmail,
      status: invoice.status,
      balanceDue: Number(invoice.balanceDue ?? invoice.grandTotal),
      grandTotal: Number(invoice.grandTotal || 0),
    },
    razorpayConfigured,
  });

  const payButton = canPayWithRazorpay ? (
    <button
      type="button"
      id="btn-razorpay-pay-detail"
      disabled={busy || payingWithRazorpay}
      onClick={() => void handlePayWithRazorpay()}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-3.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 hover:bg-zinc-800 shadow-sm"
    >
      {payingWithRazorpay ? (
        <span>Opening Razorpay…</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
          Pay with Razorpay
        </span>
      )}
    </button>
  ) : null;

  return (
    <div data-tour="invoices-detail" className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <Link to="/invoices" className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950">
            ← Invoices
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-950 m-0">{invoice.invoiceNo}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(invoice.status)}`}>
              {invoice.status}
            </span>
            {isProforma && (
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-900">
                Proforma
              </span>
            )}
            {(invoice.isRecurring || invoice.recurringProfileId) && (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                Recurring{invoice.recurringCycle ? ` #${invoice.recurringCycle}` : ''}
              </span>
            )}
            {invoice.isArchived && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600">
                Archived
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {displayLabel(invoice.clientName)}
            {showProjects && invoice.projectName ? ` · ${invoice.projectName}` : ''}
          </p>
        </div>
        <div data-tour="invoices-detail-actions" className="flex flex-wrap gap-2">
          {/* A draft is still ours to correct; once sent, the client holds these
              figures and a credit note is the honest route. */}
          {canWriteFinance && invoice.status === 'Draft' && !readOnly && (
            <Link
              to={`/invoices/${id}/edit`}
              title="Correct this invoice before sending it"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 no-underline cursor-pointer hover:bg-zinc-50"
            >
              <EditOutlinedIcon sx={{ fontSize: 15 }} /> Edit
            </Link>
          )}
          {canWriteFinance && (
            <button type="button" disabled={busy || readOnly} onClick={sendInvoice} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
              <SendIcon sx={{ fontSize: 15 }} /> Send
            </button>
          )}
          {canWriteFinance && (
            <button type="button" disabled={busy} onClick={generatePortal} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
              <LinkIcon sx={{ fontSize: 15 }} /> Portal link
            </button>
          )}
          <button type="button" disabled={busy} onClick={printInvoice} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
            <PrintIcon sx={{ fontSize: 15 }} /> Print
          </button>
          <button type="button" disabled={busy} onClick={downloadPdf} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
            <PictureAsPdfIcon sx={{ fontSize: 15 }} /> PDF
          </button>
          {payButton}
          {canConvertProforma && (
            <>
              {isSalesOrderDelivered && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  ✓ Ready to Convert
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={convertProforma}
                title="Raise the tax invoice for the full value and carry the advance across"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-900 cursor-pointer disabled:opacity-50"
              >
                <ReceiptLongIcon sx={{ fontSize: 15 }} /> Convert to tax invoice
              </button>
            </>
          )}
          {canWriteFinance && !readOnly && invoice.status !== 'Paid' && (
            <button type="button" disabled={busy} onClick={() => setWriteOffOpen(true)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 cursor-pointer disabled:opacity-50">
              <MoneyOffIcon sx={{ fontSize: 15 }} /> Write off
            </button>
          )}
          {canWriteFinance && (invoice.isArchived ? (
            <button type="button" disabled={busy} onClick={() => run(() => crmApi.restoreInvoice(id))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
              <UnarchiveIcon sx={{ fontSize: 15 }} /> Restore
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => run(() => crmApi.archiveInvoice(id))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
              <ArchiveIcon sx={{ fontSize: 15 }} /> Archive
            </button>
          ))}
          {canWriteFinance && invoice.status !== 'Cancelled' && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await confirm({ message: 'Cancel this invoice?', tone: 'danger', confirmLabel: 'Cancel invoice' })) {
                  run(() => crmApi.cancelInvoice(id));
                }
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {isProforma && (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs text-violet-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
            <p className="m-0 text-sm font-semibold">Payment request, not a tax invoice</p>
            <p className="m-0 mt-0.5 text-violet-800">
              {invoice.convertedInvoiceId
                ? 'Converted. The payment and the supply now sit on the tax invoice.'
                : 'It has its own numbering and is left out of tax and revenue reports. Convert it into a tax invoice for the full value once the work is delivered — the advance paid moves across.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {invoice.quotationId && (
              <Link
                to={`/quotations/${invoice.quotationId}`}
                className="font-semibold text-violet-900 no-underline hover:underline"
              >
                Open quotation →
              </Link>
            )}
            {invoice.convertedInvoiceId && (
              <Link
                to={`/invoices/${invoice.convertedInvoiceId}`}
                className="font-semibold text-violet-900 no-underline hover:underline"
              >
                {invoice.convertedInvoiceNo
                  ? `Open ${invoice.convertedInvoiceNo} →`
                  : 'Open tax invoice →'}
              </Link>
            )}
          </div>
        </div>
        {canConvertProforma && isSalesOrderDelivered && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-100/70 px-3.5 py-2.5 text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-emerald-800">✓ Ready to Convert:</span>
              <span>The related Sales Order has been delivered. This proforma is ready to be converted into a final tax invoice.</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={convertProforma}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-emerald-700 disabled:opacity-50"
            >
              <ReceiptLongIcon sx={{ fontSize: 14 }} /> Convert now
            </button>
          </div>
        )}
      </div>
    )}

      {!isProforma && invoice.proformaInvoiceId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-zinc-950">Raised from a proforma</p>
            <p className="m-0 mt-0.5 text-zinc-600">
              This invoice carries the full value; the advance collected on the proforma is already
              counted in Received.
            </p>
          </div>
          <Link
            to={`/invoices/${invoice.proformaInvoiceId}`}
            className="font-semibold text-zinc-900 no-underline hover:underline"
          >
            {invoice.proformaInvoiceNo ? `Open ${invoice.proformaInvoiceNo} →` : 'Open proforma →'}
          </Link>
        </div>
      )}

      {(invoice.isRecurring || invoice.recurringProfileId) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800">
          <div>
            <p className="m-0 text-sm font-semibold text-zinc-950">Generated from recurring schedule</p>
            <p className="m-0 mt-0.5 text-zinc-600">
              Recurring invoice
              {invoice.recurringCycle ? ` · Cycle #${invoice.recurringCycle}` : ''}
            </p>
          </div>
          <Link
            to="/invoices?tab=recurring"
            className="text-xs font-semibold text-zinc-800 no-underline hover:underline"
          >
            Manage recurring profiles
          </Link>
        </div>
      )}

      {portalLink && (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
              Client portal URL
            </div>
            {/* <a
              href={portalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all font-mono text-xs text-sky-800 underline select-all"
              title={portalLink}
            >
              {portalLink}
            </a> */}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-md border border-sky-300 bg-white text-sky-900 hover:bg-sky-50 cursor-pointer shadow-xs transition-colors"
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
              Copy
            </button>
            <a
              href={portalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700 no-underline shadow-xs transition-colors"
            >
              Open ↗
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Grand total', value: formatFinanceMoney(invoice.grandTotal, invoice.currency) },
          { label: 'Amount paid', value: formatFinanceMoney(invoice.amountPaid || 0, invoice.currency) },
          { label: 'Credits', value: formatFinanceMoney(invoice.creditAmount || 0, invoice.currency) },
          {
            label: 'Balance due',
            value: formatFinanceMoney(invoice.balanceDue ?? totals?.balanceDue ?? invoice.grandTotal, invoice.currency),
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-300 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase text-zinc-500">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-zinc-950">{card.value}</div>
          </div>
        ))}
      </div>

      <div data-tour="invoices-detail-sections" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-zinc-300 bg-white p-5">
          <h2 className="text-sm font-semibold m-0 mb-3">Invoice details</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm m-0">
            <div><dt className="text-[11px] uppercase text-zinc-500">Issue date</dt><dd className="m-0 font-medium">{invoice.issueDate}</dd></div>
            <div><dt className="text-[11px] uppercase text-zinc-500">Due date</dt><dd className="m-0 font-medium">{invoice.dueDate}</dd></div>
            <div><dt className="text-[11px] uppercase text-zinc-500">Currency</dt><dd className="m-0 font-medium">{invoice.currency} @ {invoice.exchangeRate}</dd></div>
            <div><dt className="text-[11px] uppercase text-zinc-500">Tax calc</dt><dd className="m-0 font-medium">{invoice.taxCalculation}</dd></div>
            <div className="col-span-2"><dt className="text-[11px] uppercase text-zinc-500">Payment details</dt><dd className="m-0 whitespace-pre-wrap">{invoice.paymentDetails || '—'}</dd></div>
            <div><dt className="text-[11px] uppercase text-zinc-500">Billing</dt><dd className="m-0 whitespace-pre-wrap text-xs">{invoice.billingAddress || '—'}</dd></div>
            <div><dt className="text-[11px] uppercase text-zinc-500">Shipping</dt><dd className="m-0 whitespace-pre-wrap text-xs">{invoice.shippingAddress || '—'}</dd></div>
            {invoice.writtenOffReason && (
              <div className="col-span-2">
                <dt className="text-[11px] uppercase text-zinc-500">Write-off reason</dt>
                <dd className="m-0">{invoice.writtenOffReason}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-300 bg-white p-5">
          <h2 className="text-sm font-semibold m-0 mb-3">Totals</h2>
          {totals && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><strong>{formatFinanceMoney(totals.subtotal, invoice.currency)}</strong></div>
              <div className="flex justify-between"><span>Discount</span><strong>-{formatFinanceMoney(totals.discount, invoice.currency)}</strong></div>
              <div className="flex justify-between"><span>Tax</span><strong>{formatFinanceMoney(totals.taxTotal, invoice.currency)}</strong></div>
              <div className="flex justify-between"><span>Shipping</span><strong>{formatFinanceMoney(totals.shippingCharge, invoice.currency)}</strong></div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base"><span>Grand total</span><strong>{formatFinanceMoney(totals.grandTotal, invoice.currency)}</strong></div>
            </div>
          )}
          {invoice.reminder?.enabled && (
            <p className="mt-4 mb-0 text-xs text-zinc-500">
              Reminders: {invoice.reminder.timing.replace(/_/g, ' ')} · {invoice.reminder.count || 1}× every{' '}
              {invoice.reminder.days || 3} days
            </p>
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
              {(invoice.lineItems || []).map((line, index) => (
                <tr key={`${line.name}-${index}`} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{line.name}</div>
                    {line.description && <div className="text-xs text-zinc-500">{line.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{line.qty}</td>
                  <td className="px-4 py-3 text-right">{formatFinanceMoney(line.rate, invoice.currency)}</td>
                  <td className="px-4 py-3 text-right">{line.tax}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatFinanceMoney(line.qty * line.rate, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-300 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-zinc-200">
          <div className="text-sm font-semibold">Payments</div>
          {payButton}
        </div>
        {!razorpayConfigured && canWriteFinance && !isClient ? (
          <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Razorpay is not configured. Configure the payment gateway in CRM settings to enable Pay with Razorpay.
          </div>
        ) : null}
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {canPayWithRazorpay
              ? 'No payments yet. Use Pay with Razorpay to collect the balance.'
              : 'No payments recorded yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Reference</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const status = String(payment.status || '');
                  const canRefund = !['Refunded', 'Cancelled', 'Failed'].includes(status);
                  return (
                  <tr key={payment._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{payment.paymentDate}</td>
                    <td className="px-4 py-3">{payment.mode || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatFinanceMoney(payment.amount, payment.currency || invoice.currency)}
                    </td>
                    <td className="px-4 py-3">{payment.status || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{payment.transactionId || '—'}</td>
                    <td className="px-4 py-3">
                      {canRefund ? (
                        <Link
                          to={`/payments/${payment._id}`}
                          className="inline-flex h-7 items-center px-2.5 text-[11px] font-semibold rounded-md border border-amber-200 bg-amber-50 text-amber-900 no-underline"
                        >
                          Refund
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(invoice.notes || invoice.terms) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {invoice.notes && (
            <section className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="text-sm font-semibold m-0 mb-2">Client notes</h2>
              <p className="m-0 text-sm whitespace-pre-wrap text-zinc-700">{invoice.notes}</p>
            </section>
          )}
          {invoice.terms && (
            <section className="rounded-xl border border-zinc-300 bg-white p-5">
              <h2 className="text-sm font-semibold m-0 mb-2">Terms</h2>
              <p className="m-0 text-sm whitespace-pre-wrap text-zinc-700">{invoice.terms}</p>
            </section>
          )}
        </div>
      )}
      </div>

      {writeOffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="m-0 text-lg font-bold">Write off bad debt</h3>
            <p className="mt-2 mb-3 text-sm text-zinc-500">A reason is required for audit compliance.</p>
            <textarea
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              rows={4}
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
              placeholder="Why is this invoice uncollectible?"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setWriteOffOpen(false)} className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={writeOff} className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50">
                Confirm write-off
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="pb-8">
        <button
          type="button"
          onClick={() => navigate('/invoices/create')}
          className="text-xs font-semibold text-zinc-500 border-0 bg-transparent cursor-pointer underline"
        >
          Create another invoice
        </button>
      </div>
    </div>
  );
};
