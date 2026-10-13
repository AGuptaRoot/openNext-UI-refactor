import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  PAYMENT_CURRENCIES,
  PAYMENT_GATEWAY_OPTIONS,
  PAYMENT_MODES,
  type PaymentMode,
} from '../../types/payments';
import type { InvoiceItem } from '../../types/invoices';
import {
  CreatePageHeader,
  FormField,
  FormSection,
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import { useFinanceOptions } from '../../components/finance/useFinanceOptions';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';
import { CrmFeatures } from '../../utils/featureFlags';

interface AllocRow {
  invoiceId: string;
  invoiceNo: string;
  status: string;
  issueDate: string;
  dueDate: string;
  grandTotal: number;
  balanceDue: number;
  selected: boolean;
  amount: number;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function invoiceBalance(invoice: InvoiceItem): number {
  return Number(invoice.balanceDue ?? Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.amountPaid || 0)));
}

function isOpenInvoice(invoice: InvoiceItem): boolean {
  return (
    !invoice.isArchived &&
    !['Paid', 'Cancelled', 'Written Off', 'Draft'].includes(String(invoice.status)) &&
    invoiceBalance(invoice) > 0
  );
}

export const PaymentCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, isClient } = useAuth();
  const canWriteFinance = hasPermission('crm.finance.write') && !isClient;
  const canRecordManualPayment = canWriteFinance && CrmFeatures.isManualPaymentEnabled();
  const { clients, projects, invoices } = useFinanceOptions();
  const [clientId, setClientId] = useState(searchParams.get('clientId') || '');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') || '');
  const [invoiceId, setInvoiceId] = useState(searchParams.get('invoiceId') || '');
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [paymentDate, setPaymentDate] = useState(localToday());
  const [mode, setMode] = useState<PaymentMode>('Bank Transfer');
  const [transactionId, setTransactionId] = useState('');
  const [paymentGateway, setPaymentGateway] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [remark, setRemark] = useState('');
  const [rows, setRows] = useState<AllocRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.clientId === clientId && isOpenInvoice(invoice))
        .sort((a, b) => String(a.dueDate || a.issueDate).localeCompare(String(b.dueDate || b.issueDate))),
    [invoices, clientId]
  );

  const outstandingTotal = useMemo(
    () => openInvoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0),
    [openInvoices]
  );

  useEffect(() => {
    if (!canRecordManualPayment) {
      navigate('/payments', { replace: true });
    }
  }, [canRecordManualPayment, navigate]);

  useEffect(() => {
    if (!clientId) {
      setRows([]);
      return;
    }
    setRows(
      openInvoices.map((invoice) => ({
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        grandTotal: Number(invoice.grandTotal || 0),
        balanceDue: invoiceBalance(invoice),
        selected: false,
        amount: 0,
      }))
    );
  }, [clientId, openInvoices]);

  useEffect(() => {
    if (!invoiceId) return;
    const invoice = openInvoices.find((item) => item._id === invoiceId);
    if (!invoice) return;
    setCurrency(invoice.currency || 'INR');
    setExchangeRate(Number(invoice.exchangeRate) || 1);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        selected: row.invoiceId === invoiceId,
        amount: row.invoiceId === invoiceId ? row.balanceDue : 0,
      }))
    );
    setAmount(invoiceBalance(invoice));
  }, [invoiceId, openInvoices]);

  const multiMode = Boolean(clientId) && !invoiceId && rows.length > 0;
  const allocatedTotal = rows.reduce((sum, row) => sum + (row.selected ? Number(row.amount) || 0 : 0), 0);
  const unallocated = Math.max(0, Number((amount - allocatedTotal).toFixed(2)));
  const selectedCount = rows.filter((row) => row.selected).length;

  const payFullDue = () => {
    if (invoiceId) {
      const invoice = openInvoices.find((item) => item._id === invoiceId);
      if (invoice) setAmount(invoiceBalance(invoice));
      return;
    }
    setAmount(Number(outstandingTotal.toFixed(2)));
  };

  const autoAllocateOldest = () => {
    let remaining = amount;
    setRows((current) =>
      current.map((row) => {
        if (remaining <= 0) return { ...row, selected: false, amount: 0 };
        const take = Math.min(remaining, row.balanceDue);
        remaining = Number((remaining - take).toFixed(2));
        return { ...row, selected: take > 0, amount: Number(take.toFixed(2)) };
      })
    );
  };

  const payAllFull = () => {
    const next = rows.map((row) => ({ ...row, selected: true, amount: row.balanceDue }));
    setRows(next);
    setAmount(Number(next.reduce((sum, row) => sum + row.amount, 0).toFixed(2)));
  };

  const clearAlloc = () => {
    setRows((current) => current.map((row) => ({ ...row, selected: false, amount: 0 })));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!canWriteFinance) {
      setError('You do not have permission to record payments.');
      return;
    }
    if (!clientId || amount <= 0 || !currency.trim() || exchangeRate <= 0 || !paymentDate || !mode) {
      setError('Customer, positive amount, currency, exchange rate, date, and mode are required.');
      return;
    }
    const allocations = multiMode
      ? rows
          .filter((row) => row.selected && row.amount > 0)
          .map((row) => ({
            invoiceId: row.invoiceId,
            invoiceNumber: row.invoiceNo,
            amount: Number(row.amount),
          }))
      : invoiceId
        ? [{ invoiceId, amount }]
        : undefined;

    if (allocations?.length) {
      const total = allocations.reduce((sum, row) => sum + row.amount, 0);
      if (total > amount + 0.0001) {
        setError('Total allocation cannot exceed the payment amount.');
        return;
      }
      if (Math.abs(amount - total) > 0.0001) {
        setError('Allocate the full payment amount before saving (unallocated balance must be zero).');
        return;
      }
      for (const row of rows.filter((item) => item.selected)) {
        if (row.amount > row.balanceDue + 0.0001) {
          setError(`Allocation for ${row.invoiceNo} exceeds balance due.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const created = await crmApi.createPayment({
        clientId,
        projectId: projectId || undefined,
        invoiceId: invoiceId || allocations?.[0]?.invoiceId,
        amount,
        currency: currency.toUpperCase(),
        exchangeRate,
        paymentDate,
        mode,
        allocations,
        transactionId: transactionId.trim() || undefined,
        paymentGateway: paymentGateway || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
        remark: remark.trim() || undefined,
      });
      const paymentId = created.data?._id;
      if (paymentId) {
        navigate(`/payments/${paymentId}`);
      } else {
        navigate('/payments');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
      setSaving(false);
    }
  };

  if (!canRecordManualPayment) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
        Manual payment entry is disabled. Clients pay via Razorpay after the invoice is sent.
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-14">
      <CreatePageHeader title="Add Payment" backLabel="Payments" backPath="/payments" saving={saving} formId="payment-form" />
      {!canWriteFinance ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You do not have permission to record payments.{' '}
          <Link to="/payments" className="font-semibold text-zinc-950 no-underline hover:underline">
            Back to payments
          </Link>
        </div>
      ) : (
        <>
      {error && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700">{error}</div>}

      <form id="payment-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FormSection title="Customer & billing allocation">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Customer" required>
              <ClientSelect
                clients={clients}
                value={clientId}
                required
                placeholder="Select customer…"
                onChange={(nextId) => {
                  setClientId(nextId);
                  setProjectId('');
                  setInvoiceId('');
                  setAmount(0);
                }}
              />
            </FormField>
            <FormField label="Project">
              <select className={financeFieldClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects
                  .filter((project) => !clientId || project.clientId === clientId)
                  .map((project) => (
                    <option key={project._id} value={project._id}>{project.name}</option>
                  ))}
              </select>
            </FormField>
            <FormField label="Invoice">
              <select
                className={financeFieldClass}
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                disabled={!clientId}
              >
                <option value="">All open invoices (multi-allocate)</option>
                {openInvoices.map((invoice) => (
                  <option key={invoice._id} value={invoice._id}>
                    {invoice.invoiceNo} · due {formatFinanceMoney(invoiceBalance(invoice), invoice.currency)} · {invoice.status}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Payment amount & currency">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Amount" required>
              <div className="flex gap-2">
                <input className={financeFieldClass} type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                <button type="button" onClick={payFullDue} disabled={!clientId} className="shrink-0 h-9 px-3 text-[11px] font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-40">
                  Pay full due
                </button>
              </div>
            </FormField>
            <FormField label="Currency" required>
              <select className={financeFieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {PAYMENT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}
              </select>
            </FormField>
            <FormField label="Exchange rate" required>
              <input className={financeFieldClass} type="number" min="0.0001" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} />
            </FormField>
            <FormField label="Payment date" required>
              <input className={financeFieldClass} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </FormField>
            <FormField label="Payment mode" required>
              <select className={financeFieldClass} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                {PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
          </div>
        </FormSection>

        {multiMode && (
          <FormSection title="Multi-invoice allocation">
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={autoAllocateOldest} disabled={amount <= 0} className="h-8 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-40">
                Auto allocate oldest
              </button>
              <button type="button" onClick={payAllFull} className="h-8 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">
                Pay all full
              </button>
              <button type="button" onClick={clearAlloc} className="h-8 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">
                Clear
              </button>
            </div>
            <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 flex flex-wrap gap-4">
              <span>Selected: <strong>{selectedCount}</strong></span>
              <span>Outstanding: <strong>{formatFinanceMoney(outstandingTotal, currency)}</strong></span>
              <span>Allocated: <strong>{formatFinanceMoney(allocatedTotal, currency)}</strong></span>
              <span>Unallocated: <strong>{formatFinanceMoney(unallocated, currency)}</strong></span>
            </div>
            <div className="overflow-x-auto border border-zinc-200 rounded-lg">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((row) => row.selected)}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((row) => ({
                              ...row,
                              selected: e.target.checked,
                              amount: e.target.checked ? row.balanceDue : 0,
                            }))
                          )
                        }
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Invoice</th>
                    <th className="px-3 py-2 text-left">Dates</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Balance due</th>
                    <th className="px-3 py-2 text-right">Allocate</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const overdue = row.dueDate && row.dueDate < localToday() && row.balanceDue > 0;
                    return (
                      <tr key={row.invoiceId} className="border-t border-zinc-100">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              setRows((current) =>
                                current.map((item) =>
                                  item.invoiceId === row.invoiceId
                                    ? {
                                        ...item,
                                        selected: e.target.checked,
                                        amount: e.target.checked ? item.balanceDue : 0,
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">{row.invoiceNo}</div>
                          <div className="text-[11px] text-zinc-500">{row.status}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-600">
                          {row.issueDate} → {row.dueDate}
                          {overdue && <div className="text-red-600 font-semibold">Overdue</div>}
                        </td>
                        <td className="px-3 py-2 text-right">{formatFinanceMoney(row.grandTotal, currency)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatFinanceMoney(row.balanceDue, currency)}</td>
                        <td className="px-3 py-2 text-right w-36">
                          <input
                            className={financeFieldClass}
                            type="number"
                            min="0"
                            max={row.balanceDue}
                            step="0.01"
                            disabled={!row.selected}
                            value={row.amount}
                            onChange={(e) =>
                              setRows((current) =>
                                current.map((item) =>
                                  item.invoiceId === row.invoiceId
                                    ? { ...item, amount: Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={!row.selected}
                            onClick={() =>
                              setRows((current) =>
                                current.map((item) =>
                                  item.invoiceId === row.invoiceId
                                    ? { ...item, amount: item.balanceDue }
                                    : item
                                )
                              )
                            }
                            className="h-8 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white cursor-pointer disabled:opacity-40"
                          >
                            Full
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </FormSection>
        )}

        <FormSection title="Transaction & payment gateway">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Transaction ID / reference">
              <input className={financeFieldClass} maxLength={150} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="UTR / cheque / gateway ID" />
            </FormField>
            <FormField label="Payment gateway">
              <select className={financeFieldClass} value={paymentGateway} onChange={(e) => setPaymentGateway(e.target.value)}>
                {PAYMENT_GATEWAY_OPTIONS.map((value) => (
                  <option key={value || 'none'} value={value}>{value || 'None / Direct'}</option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Receipt & remarks">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Receipt attachment">
              <DocumentUploadControl
                folder="payments"
                mode="button"
                buttonLabel="Choose receipt"
                uploadButtonLabel="Upload document"
                currentUrl={receiptUrl || null}
                onUploaded={(res) => setReceiptUrl(res.url || res.fileUrl || '')}
              />
            </FormField>
            <FormField label="Remark / notes" wide>
              <textarea className={financeTextAreaClass} rows={3} maxLength={1000} value={remark} onChange={(e) => setRemark(e.target.value)} />
            </FormField>
          </div>
        </FormSection>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/payments')} className="h-10 px-4 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="h-10 px-4 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50">
            {saving ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </form>
        </>
      )}
    </div>
  );
};
