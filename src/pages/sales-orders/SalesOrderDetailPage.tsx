import { displayLabel } from '../../utils/displayLabels';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { useDialog } from '../../context/DialogContext';
import { formatFinanceMoney } from '../../components/finance/FinanceListPage';
import {
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import {
  RMA_REASON_CATEGORIES,
  SALES_ORDER_COURIERS,
  remainingReturnQty,
  remainingShipQty,
  type RmaStatus,
  type RmaType,
  type SalesOrderItem,
  type SalesOrderShipment,
} from '../../types/salesOrders';
import { SalesOrderShippingTracker } from '../../components/sales-orders/SalesOrderShippingTracker';
import { getCurrencySymbol, getRuntimeDefaultCurrency } from '../../utils/currency';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Pending: 'bg-amber-50 text-amber-800',
    'On Hold': 'bg-orange-50 text-orange-800',
    Processing: 'bg-sky-50 text-sky-800',
    Approved: 'bg-emerald-50 text-emerald-800',
    'Partially Shipped': 'bg-indigo-50 text-indigo-800',
    Shipped: 'bg-blue-50 text-blue-800',
    Completed: 'bg-emerald-50 text-emerald-900',
    Cancelled: 'bg-rose-50 text-rose-800',
    Returned: 'bg-stone-100 text-stone-700',
  };
  return map[status] || 'bg-zinc-100 text-zinc-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatStockAction(action?: string): string {
  const raw = String(action || '').trim();
  if (!raw) return 'Stock update';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStockActor(entry: { performedByName?: string; performedBy?: string }): string {
  const named = String(entry.performedByName || '').trim();
  if (named && !/^[0-9a-fA-F]{24}$/.test(named)) return named;
  const raw = String(entry.performedBy || '').trim();
  if (!raw) return 'System';
  if (/^[0-9a-fA-F]{24}$/.test(raw)) return 'Team member';
  return raw;
}

function nextRmaStatuses(status: RmaStatus): RmaStatus[] {
  switch (status) {
    case 'Requested':
      return ['Approved', 'Rejected'];
    case 'Approved':
      return ['Received', 'Rejected'];
    case 'Received':
      return ['Inspected', 'Rejected'];
    case 'Inspected':
      return ['Refunded', 'Replaced', 'Rejected'];
    default:
      return [];
  }
}

type ShipSelection = Record<number, { selected: boolean; qty: number }>;
type ReturnSelection = Record<number, { selected: boolean; qty: number }>;

export const SalesOrderDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isClient, isAdmin, activeRole } = useAuth();
  const { showProjects } = useActiveExtension();
  const { confirm } = useDialog();
  const canWriteOrders = hasPermission('crm.orders.write') && !isClient;
  const canDeleteOrders = hasPermission('crm.orders.delete') && !isClient;
  const canViewOpportunities =
    (hasPermission('crm.opportunities.read') || hasPermission('crm.leads.read')) && !isClient;
  const [order, setOrder] = useState<SalesOrderItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [shipSelection, setShipSelection] = useState<ShipSelection>({});
  const [courierName, setCourierName] = useState('');
  /** Optional: blank when the courier has not issued the AWB yet. */
  const [trackingNumber, setTrackingNumber] = useState('');
  const [weightKg, setWeightKg] = useState(1);
  const [shipNotes, setShipNotes] = useState('');

  const [deliveryOpen, setDeliveryOpen] = useState<SalesOrderShipment | null>(null);
  /** Shipment whose AWB is being filled in after dispatch. */
  const [trackingTarget, setTrackingTarget] = useState<SalesOrderShipment | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [proofOfDelivery, setProofOfDelivery] = useState('');

  const [rmaOpen, setRmaOpen] = useState(false);
  const [rmaType, setRmaType] = useState<RmaType>('Return');
  const [refundAmount, setRefundAmount] = useState(0);
  const [rmaReasonCategory, setRmaReasonCategory] = useState<string>(RMA_REASON_CATEGORIES[0]);
  const [rmaReason, setRmaReason] = useState('');
  const [returnSelection, setReturnSelection] = useState<ReturnSelection>({});

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [generateInvoiceOpen, setGenerateInvoiceOpen] = useState(false);
  const [sendInvoiceEmail, setSendInvoiceEmail] = useState(true);
  const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState('');
  const [invoiceEmailNote, setInvoiceEmailNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await crmApi.getSalesOrder(id);
      setOrder(response.data);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load sales order');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShipmentOpen(false);
        setDeliveryOpen(null);
        setRmaOpen(false);
        setCancelOpen(false);
        setGenerateInvoiceOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const canShip = useMemo(() => {
    if (!canWriteOrders || !order || ['Cancelled', 'Draft'].includes(order.status)) return false;
    return (order.lineItems || []).some((line) => remainingShipQty(line) > 0);
  }, [order, canWriteOrders]);

  const isSalesManager = activeRole === 'sales-manager';
  const isAuthorizedRmaRole = isClient || isAdmin || isSalesManager || activeRole === 'crm-manager';

  /** Nothing can come back before it has arrived — the server enforces this too. */
  const isDelivered =
    !!order &&
    (order.deliveryStatus === 'Delivered' ||
      String(order.status || '').toLowerCase() === 'completed');

  const canGenerateRma = useMemo(() => {
    if (!isAuthorizedRmaRole || !order || order.status === 'Cancelled' || order.status === 'Draft') {
      return false;
    }
    if (!isDelivered) return false;
    return (order.lineItems || []).some((line) => remainingReturnQty(line) > 0);
  }, [isAuthorizedRmaRole, order, isDelivered]);

  const canReserve =
    canWriteOrders &&
    !!order &&
    !order.stockReserved &&
    order.status !== 'Cancelled' &&
    order.status !== 'Draft';
  // Staff with write access, or the linked client, can cancel before completion/dispatch.
  const canCancel =
    (canWriteOrders || isClient) &&
    !!order &&
    !['Cancelled', 'Completed'].includes(order.status);
  const canDelete = canDeleteOrders && order?.status === 'Draft';
  const canGenerateInvoice =
    canWriteOrders && !!order && order.status !== 'Cancelled' && order.status !== 'Draft';
  const canOpenInvoice =
    !!order?.convertedInvoiceId &&
    (canWriteOrders || hasPermission('crm.finance.read'));

  const run = async (fn: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setInfo('');
    try {
      await fn();
      await load();
      if (successMessage) setInfo(successMessage);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const openShipmentModal = () => {
    if (!order) return;
    const next: ShipSelection = {};
    order.lineItems.forEach((line, index) => {
      const remaining = remainingShipQty(line);
      next[index] = { selected: remaining > 0, qty: remaining };
    });
    setShipSelection(next);
    setCourierName('');
    setTrackingNumber('');
    setWeightKg(1);
    setShipNotes('');
    setShipmentOpen(true);
  };

  const submitShipment = () =>
    run(async () => {
      const items = Object.entries(shipSelection)
        .filter(([, value]) => value.selected && value.qty > 0)
        .map(([index, value]) => ({ lineItemIndex: Number(index), qty: Number(value.qty) }));
      if (!courierName.trim()) {
        throw new Error('Courier is required.');
      }
      if (!items.length) throw new Error('Select at least one item to ship.');
      await crmApi.addSalesOrderShipment(id, {
        courierName: courierName.trim(),
        trackingNumber: trackingNumber.trim(),
        weightKg,
        notes: shipNotes.trim(),
        items,
      });
      setShipmentOpen(false);
    }, 'Shipment dispatched.');

  const openTrackingEditor = (shipment: SalesOrderShipment) => {
    setTrackingTarget(shipment);
    setTrackingDraft(shipment.trackingNumber || '');
  };

  const submitTrackingNumber = () =>
    run(async () => {
      if (!trackingTarget) return;
      await crmApi.updateSalesOrderShipment(id, trackingTarget._id, {
        trackingNumber: trackingDraft.trim(),
      });
      setTrackingTarget(null);
      setTrackingDraft('');
    }, 'Tracking number saved.');

  const submitDelivery = () =>
    run(async () => {
      if (!deliveryOpen) return;
      if (!proofOfDelivery.trim()) throw new Error('Proof of delivery is required.');
      await crmApi.confirmSalesOrderDelivery(id, {
        shipmentId: deliveryOpen._id,
        proofOfDelivery: proofOfDelivery.trim(),
      });
      setDeliveryOpen(null);
      setProofOfDelivery('');
    }, 'Delivery confirmed.');

  const calculateRefundTotal = useCallback(
    (selection: ReturnSelection): number => {
      if (!order) return 0;
      let total = 0;
      Object.entries(selection).forEach(([indexStr, item]) => {
        if (item.selected && Number(item.qty) > 0) {
          const line = order.lineItems[Number(indexStr)];
          if (line) {
            total += Number(item.qty) * Number(line.rate || 0);
          }
        }
      });
      return Math.round(total * 100) / 100;
    },
    [order]
  );

  const toggleReturnItem = (index: number, selected: boolean) => {
    if (!order) return;
    const line = order.lineItems[index];
    if (!line) return;
    const remaining = remainingReturnQty(line);
    const current = returnSelection[index] || { selected: false, qty: remaining };
    const next: ReturnSelection = {
      ...returnSelection,
      [index]: {
        selected,
        qty: current.qty > 0 ? current.qty : remaining,
      },
    };
    setReturnSelection(next);
    setRefundAmount(calculateRefundTotal(next));
  };

  const updateReturnItemQty = (index: number, nextQty: number) => {
    if (!order) return;
    const line = order.lineItems[index];
    if (!line) return;
    const remaining = remainingReturnQty(line);
    // Allow decreasing quantity; clamped strictly between 1 and remaining
    const clampedQty = Math.min(remaining, Math.max(1, Number(nextQty) || 1));
    const current = returnSelection[index] || { selected: true, qty: remaining };
    const next: ReturnSelection = {
      ...returnSelection,
      [index]: {
        ...current,
        qty: clampedQty,
      },
    };
    setReturnSelection(next);
    setRefundAmount(calculateRefundTotal(next));
  };

  const openRmaModal = () => {
    if (!order) return;
    const next: ReturnSelection = {};
    order.lineItems.forEach((line, index) => {
      const remaining = remainingReturnQty(line);
      next[index] = { selected: remaining > 0, qty: remaining > 0 ? remaining : 0 };
    });
    setReturnSelection(next);
    setRmaType('Return');
    setRefundAmount(calculateRefundTotal(next));
    setRmaReasonCategory(RMA_REASON_CATEGORIES[0]);
    setRmaReason('');
    setRmaOpen(true);
  };

  const submitRma = () =>
    run(async () => {
      if (!order) throw new Error('Sales order not loaded.');
      if (!rmaReasonCategory.trim() || !rmaReason.trim()) {
        throw new Error('RMA reason category and detailed note are required.');
      }

      const returnedItems = Object.entries(returnSelection)
        .filter(([, value]) => value.selected && Number(value.qty) > 0)
        .map(([index, value]) => {
          const line = order.lineItems[Number(index)];
          if (!line) throw new Error('Invalid returned line item.');
          const qty = Number(value.qty);
          const remaining = remainingReturnQty(line);
          if (!(qty > 0) || qty > remaining) {
            throw new Error(`Invalid return qty for ${line.description || 'item'}.`);
          }
          return {
            description: String(line.description || '').trim(),
            qty,
            unitRate: Number(line.rate || 0),
            productId: line.productId || null,
            reason: rmaReasonCategory.trim(),
          };
        });

      if (!returnedItems.length) throw new Error('Select at least one returned item.');

      // For clients, always enforce the exact calculated refund total based on returned items & rates
      const calculatedTotal = calculateRefundTotal(returnSelection);
      const finalRefundAmount = isClient
        ? calculatedTotal
        : (rmaType === 'Return' ? Number(refundAmount || 0) : 0);

      await crmApi.createSalesOrderReturn(id, {
        type: rmaType,
        refundAmount: finalRefundAmount,
        reasonCategory: rmaReasonCategory,
        reason: rmaReason.trim(),
        returnedItems,
      });
      setRmaOpen(false);
    }, 'RMA request submitted.');

  const advanceRma = (returnId: string, status: RmaStatus) =>
    run(async () => {
      await crmApi.updateSalesOrderReturnStatus(id, returnId, { status });
    }, `RMA updated to ${status}.`);

  const submitCancel = () =>
    run(async () => {
      if (!cancelReason.trim()) throw new Error('Cancellation reason is required.');
      await crmApi.cancelSalesOrder(id, { reason: cancelReason.trim() });
      setCancelOpen(false);
      setCancelReason('');
    }, 'Sales order cancelled.');

  const openGenerateInvoiceModal = async () => {
    if (!order) return;
    if (order.convertedInvoiceId) {
      navigate(`/invoices/${order.convertedInvoiceId}`);
      return;
    }
    let email = order.customerEmail || order.clientEmail || '';
    if (!email && order.clientId) {
      try {
        const clientRes = await crmApi.getClient(order.clientId);
        if (clientRes?.data?.email) {
          email = clientRes.data.email;
        }
      } catch {
        // ignore client fetch error
      }
    }
    setInvoiceRecipientEmail(email);
    setSendInvoiceEmail(true);
    setInvoiceEmailNote('');
    setGenerateInvoiceOpen(true);
  };

  const submitGenerateInvoice = () =>
    run(async () => {
      if (!order) return;
      if (sendInvoiceEmail) {
        const email = invoiceRecipientEmail.trim();
        if (!email || !email.includes('@')) {
          throw new Error('Please enter a valid client recipient email address to send the invoice.');
        }
      }
      const invoice = await crmApi.generateInvoiceFromSalesOrder(id, {
        sendEmail: sendInvoiceEmail,
        clientEmail: sendInvoiceEmail ? invoiceRecipientEmail.trim() : undefined,
        emailMessage: sendInvoiceEmail && invoiceEmailNote.trim() ? invoiceEmailNote.trim() : undefined,
      });

      if (sendInvoiceEmail && invoice.data?._id && invoice.data.status !== 'Sent') {
        try {
          await crmApi.sendInvoice(invoice.data._id, {
            email: invoiceRecipientEmail.trim(),
            message: invoiceEmailNote.trim() || undefined,
          });
        } catch (sendErr) {
          console.warn('Frontend invoice send dispatch fallback:', sendErr);
        }
      }

      setGenerateInvoiceOpen(false);
      const successMsg = sendInvoiceEmail
        ? `Invoice ${invoice.data.invoiceNo} generated and emailed to ${invoiceRecipientEmail.trim()}.`
        : `Invoice ${invoice.data.invoiceNo} generated successfully.`;
      setInfo(successMsg);
    }, 'Tax invoice generated.');

  const deleteDraft = async () => {
    if (!order || order.status !== 'Draft') return;
    if (!(await confirm({ message: `Delete draft ${order.orderNumber}?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    setBusy(true);
    try {
      await crmApi.deleteSalesOrder(id);
      navigate('/sales-orders');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delete failed');
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-zinc-500">Loading sales order…</div>;
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error || 'Sales order not found.'}
        </div>
        <Link to="/sales-orders" className="text-sm font-semibold text-zinc-700">
          ← Back to sales orders
        </Link>
      </div>
    );
  }

  return (
    <div data-tour="sales-orders-detail" className="flex flex-col gap-5 pb-14">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div data-tour="sales-orders-detail-header">
          <Link
            to="/sales-orders"
            className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950"
          >
            ← Sales Orders
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-950 m-0">{order.orderNumber}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(
                order.status
              )}`}
            >
              {order.status}
            </span>
            {order.deliveryStatus && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-700">
                {order.deliveryStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {displayLabel(order.clientName)}
            {showProjects && order.projectName ? ` · ${order.projectName}` : ''}
            {' · '}Issued {formatDate(order.issueDate)}
            {order.deliveryTargetDate ? ` · Target ${formatDate(order.deliveryTargetDate)}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Grand total</span>
              <div className="font-bold text-zinc-950">
                {formatFinanceMoney(order.grandTotal, order.currency)}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Shipping</span>
              <div className="font-semibold text-zinc-800">
                {formatFinanceMoney(order.shippingCharge, order.currency)}
              </div>
            </div>
            {order.convertedInvoiceId && (
              <div>
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Invoice</span>
                <div>
                  <Link
                    to={`/invoices/${order.convertedInvoiceId}`}
                    className="font-semibold text-zinc-950 hover:underline"
                  >
                    {displayLabel(order.convertedInvoiceNo)}
                  </Link>
                </div>
              </div>
            )}
            {order.opportunityId && (
              <div>
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Opportunity</span>
                <div>
                  {canViewOpportunities ? (
                    <Link
                      to={`/opportunities/${order.opportunityId}`}
                      className="font-semibold text-zinc-950 hover:underline"
                    >
                      {displayLabel(order.opportunityTitle) || 'Open Opportunity'}
                    </Link>
                  ) : (
                    <span className="font-semibold text-zinc-950">
                      {displayLabel(order.opportunityTitle) || 'Linked'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div data-tour="sales-orders-detail-actions" className="flex flex-wrap gap-2">
          {canWriteOrders && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => crmApi.notifySalesOrderCustomer(id, { focus: 'order' }),
                    'Order status emailed to customer.'
                  )
                }
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
                title="Email linked customer the current order status"
              >
                <EmailOutlinedIcon sx={{ fontSize: 15 }} /> Email order status
              </button>
              {(order.returns || []).length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => crmApi.notifySalesOrderCustomer(id, { focus: 'rma' }),
                      'RMA status emailed to customer.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
                  title="Email linked customer the latest RMA status"
                >
                  <EmailOutlinedIcon sx={{ fontSize: 15 }} /> Email RMA status
                </button>
              )}
            </>
          )}
          {canReserve && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => crmApi.reserveSalesOrderStock(id), 'Order approved.')
              }
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
            >
              <InventoryIcon sx={{ fontSize: 15 }} /> Approved
            </button>
          )}
          {canShip && (
            <button
              type="button"
              disabled={busy}
              onClick={openShipmentModal}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
            >
              <LocalShippingIcon sx={{ fontSize: 15 }} /> Add shipment
            </button>
          )}
          {canGenerateRma && (
            <button
              type="button"
              disabled={busy}
              onClick={openRmaModal}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer disabled:opacity-50"
            >
              <AssignmentReturnIcon sx={{ fontSize: 15 }} /> Request RMA
            </button>
          )}
          {canGenerateInvoice && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (order.convertedInvoiceId) {
                  navigate(`/invoices/${order.convertedInvoiceId}`);
                  return;
                }
                openGenerateInvoiceModal();
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
            >
              <ReceiptLongIcon sx={{ fontSize: 15 }} />{' '}
              {order.convertedInvoiceId ? 'Open invoice' : 'Generate invoice'}
            </button>
          )}
          {!canGenerateInvoice && canOpenInvoice && (
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate(`/invoices/${order.convertedInvoiceId}`)}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
            >
              <ReceiptLongIcon sx={{ fontSize: 15 }} /> Open invoice
            </button>
          )}
          {order.convertedInvoiceId && (canWriteOrders || hasPermission('crm.finance.write')) && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => crmApi.sendInvoice(order.convertedInvoiceId!),
                  'Invoice emailed to customer.'
                )
              }
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer disabled:opacity-50"
              title="Email linked tax invoice to customer"
            >
              <EmailOutlinedIcon sx={{ fontSize: 15 }} /> Email invoice
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCancelReason('');
                setCancelOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
            >
              <CancelIcon sx={{ fontSize: 15 }} /> Cancel order
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={deleteDraft}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 cursor-pointer disabled:opacity-50"
            >
              <DeleteOutlineIcon sx={{ fontSize: 15 }} /> Delete
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {info && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {info}
        </div>
      )}

      {order.opportunityId && (
        <section
          data-tour="sales-orders-detail-related-opportunity"
          className="bg-white border border-sky-200 rounded-xl p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-950 m-0 mb-1 inline-flex items-center gap-1.5">
                <WorkOutlineIcon sx={{ fontSize: 16 }} />
                Related Opportunity
              </h2>
              <p className="text-xs text-zinc-500 m-0">
                Linked by opportunityId · one Sales Order per opportunity
              </p>
            </div>
            {canViewOpportunities ? (
              <Link
                to={`/opportunities/${order.opportunityId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-semibold no-underline text-sky-900 hover:bg-sky-100"
              >
                <OpenInNewIcon sx={{ fontSize: 15 }} />
                Open Opportunity
              </Link>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Opportunity</div>
              <div className="font-semibold text-zinc-950">
                {canViewOpportunities ? (
                  <Link
                    to={`/opportunities/${order.opportunityId}`}
                    className="text-zinc-950 no-underline hover:underline"
                  >
                    {displayLabel(order.opportunityTitle) || order.opportunityId}
                  </Link>
                ) : (
                  displayLabel(order.opportunityTitle) || order.opportunityId
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Stage</div>
              <div>{order.opportunityStage || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Deal value</div>
              <div>
                {order.opportunityExpectedRevenue != null
                  ? formatFinanceMoney(
                      order.opportunityExpectedRevenue,
                      order.opportunityCurrency || order.currency
                    )
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Currency</div>
              <div>{order.opportunityCurrency || order.currency || '—'}</div>
            </div>
          </div>
          <p className="mt-3 mb-0 text-sm font-semibold text-zinc-800">
            {[
              order.opportunityTitle || 'Opportunity',
              order.opportunityStage || null,
              order.opportunityExpectedRevenue != null
                ? formatFinanceMoney(
                    order.opportunityExpectedRevenue,
                    order.opportunityCurrency || order.currency
                  )
                : null,
            ]
              .filter(Boolean)
              .join(' | ')}
          </p>
        </section>
      )}

      <SalesOrderShippingTracker order={order} />

      <section data-tour="sales-orders-detail-order-info" className="bg-white border border-zinc-300 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-3">Order details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Generated by</div>
            <div>{order.generatedBy || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Destination state</div>
            <div>{order.shippingState || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Approval</div>
            <div>
              {order.stockReserved
                ? `Approved${order.stockReservedAt ? ` · ${formatDateTime(order.stockReservedAt)}` : ''}`
                : 'Not approved'}
              {order.inventoryDeducted ? ' · Inventory deducted' : ''}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Billing address</div>
            <div className="whitespace-pre-wrap text-zinc-700">{order.billingAddress || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Shipping address</div>
            <div className="whitespace-pre-wrap text-zinc-700">{order.shippingAddress || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Notes</div>
            <div className="whitespace-pre-wrap text-zinc-700">{order.notes || '—'}</div>
          </div>
          {order.cancellationReason && (
            <div className="sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Cancellation reason</div>
              <div className="text-red-700">{order.cancellationReason}</div>
            </div>
          )}
        </div>
      </section>

      <section data-tour="sales-orders-detail-lines" className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-950 m-0">Line items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Shipped</th>
                <th className="px-4 py-3">Returned</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Tax %</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(order.lineItems || []).map((line, index) => (
                <tr key={`${line.description}-${index}`} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-950">{line.description}</td>
                  <td className="px-4 py-3 text-zinc-600">{line.sku || '—'}</td>
                  <td className="px-4 py-3">{line.qty}</td>
                  <td className="px-4 py-3">{line.shippedQty || 0}</td>
                  <td className="px-4 py-3">{line.returnedQty || 0}</td>
                  <td className="px-4 py-3">{formatFinanceMoney(line.rate, order.currency)}</td>
                  <td className="px-4 py-3">{line.tax ?? 0}</td>
                  <td className="px-4 py-3 font-semibold">
                    {formatFinanceMoney(line.amount ?? line.qty * line.rate, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-zinc-50">
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Subtotal</div>
            <div className="font-semibold">{formatFinanceMoney(order.subtotal || 0, order.currency)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Discount</div>
            <div className="font-semibold">
              {formatFinanceMoney(order.discountTotal || 0, order.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Tax</div>
            <div className="font-semibold">{formatFinanceMoney(order.taxTotal || 0, order.currency)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-500">Grand total</div>
            <div className="font-bold">{formatFinanceMoney(order.grandTotal, order.currency)}</div>
          </div>
        </div>
      </section>

      <section data-tour="sales-orders-detail-shipments" className="bg-white border border-zinc-300 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-3">Shipments</h2>
        {(order.shipments || []).length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No shipments dispatched yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(order.shipments || []).map((shipment) => (
              <div
                key={shipment._id}
                className="rounded-lg border border-zinc-200 p-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3"
              >
                <div className="text-sm">
                  <div className="font-semibold text-zinc-950">
                    {shipment.shipmentNumber} · {shipment.courierName}
                  </div>
                  <div className="text-zinc-600 mt-1">
                    {shipment.trackingNumber ? (
                      `AWB ${shipment.trackingNumber}`
                    ) : (
                      <button
                        type="button"
                        onClick={() => openTrackingEditor(shipment)}
                        className="border-0 bg-transparent p-0 text-xs font-semibold text-blue-700 underline cursor-pointer"
                      >
                        Add tracking number
                      </button>
                    )}
                    {shipment.weightKg != null ? ` · ${shipment.weightKg} kg` : ''}
                  </div>
                  <div className="text-zinc-600 mt-1">
                    Status: {shipment.deliveryStatus} · Dispatched {formatDateTime(shipment.dispatchedAt)}
                    {shipment.deliveredAt ? ` · Delivered ${formatDateTime(shipment.deliveredAt)}` : ''}
                  </div>
                  {shipment.notes && <div className="text-zinc-500 mt-1">{shipment.notes}</div>}
                  {shipment.proofOfDelivery && (
                    <div className="text-zinc-600 mt-1">POD: {shipment.proofOfDelivery}</div>
                  )}
                  <div className="text-xs text-zinc-500 mt-2">
                    Items:{' '}
                    {(shipment.shippedItems || [])
                      .map((item) => `${item.description} × ${item.qty}`)
                      .join(', ') || '—'}
                  </div>
                </div>
                {canWriteOrders && shipment.deliveryStatus !== 'Delivered' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDeliveryOpen(shipment);
                      setProofOfDelivery('');
                    }}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircleOutlineIcon sx={{ fontSize: 15 }} /> Confirm delivery
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-tour="sales-orders-detail-rma" className="bg-white border border-zinc-300 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-950 m-0">Returns / RMA</h2>
          {canGenerateRma && (
            <button
              type="button"
              disabled={busy}
              onClick={openRmaModal}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-semibold rounded-lg border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer disabled:opacity-50"
            >
              <AssignmentReturnIcon sx={{ fontSize: 14 }} /> Request RMA
            </button>
          )}
        </div>
        {(order.returns || []).length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No RMA requests.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(order.returns || []).map((rma) => (
              <div key={rma._id} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-semibold text-zinc-950">
                      {rma.rmaNumber} · {rma.type} · {rma.status}
                    </div>
                    <div className="text-zinc-600 mt-1">
                      {rma.reasonCategory ? `${rma.reasonCategory} · ` : ''}
                      {rma.reason}
                    </div>
                    {rma.type === 'Return' && (
                      <div className="text-zinc-600 mt-1">
                        Refund: {formatFinanceMoney(rma.refundAmount || 0, order.currency)}
                      </div>
                    )}
                    {rma.replacementOrderId && (
                      <div className="mt-1">
                        Replacement:{' '}
                        <Link
                          to={`/sales-orders/${rma.replacementOrderId}`}
                          className="font-semibold text-zinc-950 hover:underline"
                        >
                          Open order
                        </Link>
                      </div>
                    )}
                    <div className="text-xs text-zinc-500 mt-2">
                      Items:{' '}
                      {(rma.returnedItems || [])
                        .map((item) => `${item.description} × ${item.qty}`)
                        .join(', ') || '—'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {canWriteOrders && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              crmApi.notifySalesOrderCustomer(id, {
                                focus: 'rma',
                                returnId: rma._id,
                              }),
                            'RMA status emailed to customer.'
                          )
                        }
                        className="h-7 px-2 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white text-zinc-800 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <EmailOutlinedIcon sx={{ fontSize: 13 }} /> Email
                      </button>
                    )}
                    {canWriteOrders &&
                      nextRmaStatuses(rma.status).map((next) => (
                      <button
                        key={next}
                        type="button"
                        disabled={busy}
                        onClick={() => advanceRma(rma._id, next)}
                        className={`h-7 px-2 text-[11px] font-semibold rounded-md border cursor-pointer disabled:opacity-50 ${
                          next === 'Rejected'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-zinc-200 bg-white text-zinc-800'
                        }`}
                      >
                        {next}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-tour="sales-orders-detail-stock-audit" className="bg-white border border-zinc-300 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-3">Stock audit</h2>
        {(order.stockAudit || []).length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No stock audit entries.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {(order.stockAudit || []).map((entry, index) => (
              <li
                key={`${entry.action}-${entry.performedAt}-${index}`}
                className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-zinc-950">{formatStockAction(entry.action)}</span>
                <span className="text-zinc-500"> · {formatDateTime(entry.performedAt)}</span>
                <span className="text-zinc-500"> · {formatStockActor(entry)}</span>
                {entry.details && <div className="text-zinc-600 mt-0.5">{entry.details}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {shipmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-zinc-300 bg-white p-5 shadow-lg my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-950 m-0">Dispatch shipment</h3>
              <button
                type="button"
                onClick={() => setShipmentOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto mb-3">
              {(order.lineItems || []).map((line, index) => {
                const remaining = remainingShipQty(line);
                if (remaining <= 0) return null;
                const sel = shipSelection[index] || { selected: false, qty: remaining };
                return (
                  <label
                    key={index}
                    className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={sel.selected}
                      onChange={(event) =>
                        setShipSelection((prev) => ({
                          ...prev,
                          [index]: { ...sel, selected: event.target.checked },
                        }))
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{line.description}</div>
                      <div className="text-xs text-zinc-500">Remaining: {remaining}</div>
                      <input
                        type="number"
                        min={1}
                        max={remaining}
                        value={sel.qty}
                        disabled={!sel.selected}
                        onChange={(event) =>
                          setShipSelection((prev) => ({
                            ...prev,
                            [index]: {
                              ...sel,
                              qty: Math.min(remaining, Math.max(1, Number(event.target.value) || 1)),
                            },
                          }))
                        }
                        className={`${financeFieldClass} mt-2 max-w-[120px]`}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Courier *</span>
                <select
                  className={financeFieldClass}
                  value={courierName}
                  onChange={(event) => setCourierName(event.target.value)}
                >
                  <option value="">Select courier…</option>
                  {SALES_ORDER_COURIERS.map((courier) => (
                    <option key={courier} value={courier}>
                      {courier}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">
                  Tracking number / AWB
                </span>
                <input
                  className={financeFieldClass}
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="Leave blank if not issued yet"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Weight (kg)</span>
                <input
                  className={financeFieldClass}
                  type="number"
                  min={0}
                  step="0.1"
                  value={weightKg}
                  onChange={(event) => setWeightKg(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Dispatch notes</span>
                <input
                  className={financeFieldClass}
                  value={shipNotes}
                  onChange={(event) => setShipNotes(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShipmentOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitShipment}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                Dispatch package
              </button>
            </div>
          </div>
        </div>
      )}

      {trackingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-5 shadow-lg">
            <h3 className="m-0 mb-1 text-sm font-semibold text-zinc-950">
              Tracking number · {trackingTarget.shipmentNumber}
            </h3>
            <p className="m-0 mb-3 text-xs text-zinc-500">
              {trackingTarget.courierName}. Leave it blank for a hand delivery.
            </p>
            <input
              className={financeFieldClass}
              value={trackingDraft}
              autoFocus
              onChange={(event) => setTrackingDraft(event.target.value)}
              placeholder="AWB / docket number"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTrackingTarget(null)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitTrackingNumber}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-950 m-0">
                Confirm delivery · {deliveryOpen.shipmentNumber}
              </h3>
              <button
                type="button"
                onClick={() => setDeliveryOpen(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">
                Proof of delivery *
              </span>
              <textarea
                className={financeTextAreaClass}
                rows={4}
                value={proofOfDelivery}
                onChange={(event) => setProofOfDelivery(event.target.value)}
                placeholder="Recipient name, signature reference, or delivery verification notes"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeliveryOpen(null)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitDelivery}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-emerald-700 bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
              >
                Confirm delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {rmaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-zinc-300 bg-white p-5 shadow-lg my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-950 m-0">Request return / RMA</h3>
              <button
                type="button"
                onClick={() => setRmaOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Request type *</span>
                <select
                  className={financeFieldClass}
                  value={rmaType}
                  onChange={(event) => setRmaType(event.target.value as RmaType)}
                >
                  <option value="Return">Return & refund</option>
                  <option value="Replacement">Defect replacement</option>
                </select>
              </label>
              {rmaType === 'Return' && (
                <label className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase text-zinc-500">
                      Refund amount ({getCurrencySymbol(order.currency || getRuntimeDefaultCurrency())}) *
                    </span>
                    {isClient && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Auto-calculated
                      </span>
                    )}
                  </div>
                  <input
                    className={`${financeFieldClass} ${
                      isClient
                        ? 'bg-zinc-100 text-zinc-700 font-semibold cursor-not-allowed select-none border-zinc-200'
                        : ''
                    }`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={refundAmount}
                    readOnly={isClient}
                    disabled={isClient}
                    onChange={(event) => {
                      if (!isClient) {
                        setRefundAmount(Number(event.target.value));
                      }
                    }}
                    title={isClient ? 'Refund amount is automatically calculated for clients and cannot be edited' : undefined}
                  />
                  {isClient && (
                    <span className="text-[10px] text-zinc-500">
                      Refund amount is automatically calculated based on returned items & unit rates and cannot be changed.
                    </span>
                  )}
                </label>
              )}
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">
                  Reason category *
                </span>
                <select
                  className={financeFieldClass}
                  value={rmaReasonCategory}
                  onChange={(event) => setRmaReasonCategory(event.target.value)}
                >
                  {RMA_REASON_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-zinc-500">Detailed note *</span>
                <textarea
                  className={financeTextAreaClass}
                  rows={3}
                  value={rmaReason}
                  onChange={(event) => setRmaReason(event.target.value)}
                  placeholder="Describe defects, transit damages, or reason for return..."
                />
              </label>
            </div>
            <div className="flex flex-col gap-2.5 max-h-[42vh] overflow-y-auto mb-3 pr-0.5">
              {(order.lineItems || []).map((line, index) => {
                const remaining = remainingReturnQty(line);
                if (remaining <= 0) return null;
                const sel = returnSelection[index] || { selected: false, qty: remaining };
                const lineRate = Number(line.rate || 0);
                const lineRefund = Number(sel.qty || 0) * lineRate;

                return (
                  <div
                    key={index}
                    className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                      sel.selected
                        ? 'border-zinc-300 bg-zinc-50/70 shadow-xs'
                        : 'border-zinc-200 bg-white opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none min-w-0">
                        <input
                          type="checkbox"
                          checked={sel.selected}
                          onChange={(e) => toggleReturnItem(index, e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-950 text-sm block truncate">
                            {line.description}
                          </span>
                          <span className="text-xs text-zinc-500">
                            Unit rate: {formatFinanceMoney(lineRate, order.currency)} · Returnable max: {remaining}
                          </span>
                        </div>
                      </label>
                      {sel.selected && (
                        <span className="text-xs font-bold text-zinc-900 shrink-0">
                          {formatFinanceMoney(lineRefund, order.currency)}
                        </span>
                      )}
                    </div>

                    {sel.selected && (
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-200/80">
                        <span className="text-xs font-medium text-zinc-600">
                          Return Quantity:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={sel.qty <= 1}
                            onClick={() => updateReturnItemQty(index, sel.qty - 1)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 text-sm font-bold disabled:opacity-40 cursor-pointer"
                            title="Decrease quantity"
                          >
                            –
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={remaining}
                            value={sel.qty}
                            onChange={(e) => updateReturnItemQty(index, Number(e.target.value))}
                            className={`${financeFieldClass} h-7 w-16 text-center text-xs font-bold px-1`}
                          />
                          <button
                            type="button"
                            disabled={sel.qty >= remaining}
                            onClick={() => updateReturnItemQty(index, sel.qty + 1)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 text-sm font-bold disabled:opacity-40 cursor-pointer"
                            title="Increase quantity (up to max returnable)"
                          >
                            +
                          </button>
                          <span className="text-[11px] text-zinc-400">/ {remaining}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRmaOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitRma}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-red-700 bg-red-700 text-white cursor-pointer disabled:opacity-50"
              >
                Submit RMA request
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-950 m-0">Cancel sales order</h3>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 m-0 mb-3">
              {isClient
                ? 'You can cancel this order only before packages are dispatched. After dispatch, request an RMA instead.'
                : 'Cancellation is blocked if packages have already been dispatched or delivered. Use RMA instead in that case.'}
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">
                Cancellation reason *
              </span>
              <textarea
                className={financeTextAreaClass}
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-zinc-300 bg-white cursor-pointer"
              >
                Keep order
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitCancel}
                className="h-9 px-3 text-xs font-semibold rounded-lg border border-red-700 bg-red-700 text-white cursor-pointer disabled:opacity-50"
              >
                Cancel order
              </button>
            </div>
          </div>
        </div>
      )}

      {generateInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ReceiptLongIcon sx={{ fontSize: 20 }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-950 m-0">Generate Tax Invoice</h3>
                  <p className="text-xs text-zinc-500 m-0">
                    Sales Order {order.orderNumber} · {displayLabel(order.clientName)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGenerateInvoiceOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-700 bg-white cursor-pointer"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3.5 text-xs grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-zinc-400">Order Number</span>
                  <div className="font-semibold text-zinc-900 mt-0.5">{order.orderNumber}</div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-zinc-400">Grand Total</span>
                  <div className="font-bold text-zinc-950 mt-0.5">
                    {formatFinanceMoney(order.grandTotal, order.currency)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-zinc-400">Line Items</span>
                  <div className="font-medium text-zinc-700 mt-0.5">
                    {order.lineItems?.length || 0} items
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-zinc-400">Client / Customer</span>
                  <div className="font-medium text-zinc-700 truncate mt-0.5" title={order.clientName}>
                    {displayLabel(order.clientName)}
                  </div>
                </div>
              </div>

              {/* Email Option Card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendInvoiceEmail}
                    onChange={(e) => setSendInvoiceEmail(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-950">
                        Send invoice to client via email
                      </span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full border border-blue-200">
                        Email Option
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 m-0 mt-0.5">
                      Automatically dispatch the finalized tax invoice with PDF attachment and online payment link directly to the customer.
                    </p>
                  </div>
                </label>

                {sendInvoiceEmail && (
                  <div className="pt-2 border-t border-blue-200/80 space-y-3 pl-7">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase text-zinc-700">
                        Client Recipient Email *
                      </span>
                      <input
                        type="email"
                        value={invoiceRecipientEmail}
                        onChange={(e) => setInvoiceRecipientEmail(e.target.value)}
                        placeholder="client@company.com"
                        className={`${financeFieldClass} bg-white text-xs`}
                        required
                      />
                      <span className="text-[10px] text-zinc-500">
                        Recipient will receive an email with payment link and downloadable PDF invoice.
                      </span>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase text-zinc-700">
                        Optional Note / Message to Client
                      </span>
                      <textarea
                        rows={2}
                        value={invoiceEmailNote}
                        onChange={(e) => setInvoiceEmailNote(e.target.value)}
                        placeholder="Thank you for your order! Please find attached your tax invoice."
                        className={`${financeTextAreaClass} bg-white text-xs`}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setGenerateInvoiceOpen(false)}
                className="h-9 px-3.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitGenerateInvoice}
                className={`h-9 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm ${
                  sendInvoiceEmail
                    ? 'border border-blue-600 bg-blue-600 hover:bg-blue-700'
                    : 'border border-zinc-900 bg-zinc-900 hover:bg-zinc-800'
                }`}
              >
                {sendInvoiceEmail ? (
                  <>
                    <EmailOutlinedIcon sx={{ fontSize: 16 }} /> Generate & Email to Client
                  </>
                ) : (
                  <>
                    <ReceiptLongIcon sx={{ fontSize: 16 }} /> Generate Invoice Only
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
