import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  SalesOrderDeliveryStatus,
  SalesOrderItem,
  SalesOrderStatus,
} from '../../types/salesOrders';

export interface ShippingStepDef {
  id: string;
  label: string;
  description: string;
}

/** Happy-path shipping / fulfillment stages shown on the vertical stepper. */
export const SALES_ORDER_SHIPPING_STEPS: ShippingStepDef[] = [
  {
    id: 'created',
    label: 'Order created',
    description: 'Sales order saved and awaiting approval',
  },
  {
    id: 'approved',
    label: 'Approved',
    description: 'Order approved for fulfillment',
  },
  {
    id: 'processing',
    label: 'Processing',
    description: 'Stock reserved / packing in progress',
  },
  {
    id: 'dispatched',
    label: 'Dispatched',
    description: 'Shipment handed to courier',
  },
  {
    id: 'in_transit',
    label: 'In transit',
    description: 'Package moving to destination',
  },
  {
    id: 'delivered',
    label: 'Delivered',
    description: 'Customer received the shipment',
  },
];

function normalizeStatus(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Map order + delivery + shipment state onto the vertical shipping stepper index.
 * Returns -1 for terminal non-happy paths (Cancelled) handled separately in UI.
 */
export function resolveShippingStepIndex(
  status: SalesOrderStatus | string,
  deliveryStatus?: SalesOrderDeliveryStatus | string,
  options: {
    stockReserved?: boolean;
    shipmentCount?: number;
    anyInTransit?: boolean;
    allDelivered?: boolean;
  } = {}
): number {
  const st = normalizeStatus(status);
  const ds = normalizeStatus(deliveryStatus);
  const {
    stockReserved = false,
    shipmentCount = 0,
    anyInTransit = false,
    allDelivered = false,
  } = options;

  if (st === 'cancelled') return -1;
  if (st === 'returned') return 5;
  if (st === 'completed' || st === 'delivered' || ds === 'delivered' || allDelivered) return 5;
  if (ds === 'in-transit' || anyInTransit) return 4;
  if (
    st === 'shipped' ||
    st === 'partially shipped' ||
    ds === 'dispatched' ||
    ds === 'partially dispatched' ||
    shipmentCount > 0
  ) {
    return 3;
  }
  if (st === 'processing' || stockReserved || ds === 'allocated') return 2;
  if (st === 'approved') return 1;
  // Draft / Pending / On Hold / Failed → created
  return 0;
}

const CustomStepIcon: React.FC<{
  active?: boolean;
  completed?: boolean;
  icon: React.ReactNode;
}> = ({ active, completed, icon }) => {
  if (completed) {
    return <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 22 }} />;
  }
  if (active) {
    return (
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          bgcolor: '#09090b',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {icon}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        bgcolor: '#f4f4f5',
        color: '#71717a',
        border: '1px solid #d4d4d8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {icon}
    </Box>
  );
};

function formatWhen(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 16);
  return parsed.toLocaleString();
}

export interface SalesOrderShippingTrackerProps {
  order: SalesOrderItem;
}

/**
 * Vertical MUI Stepper + Recharts product shipping progress for a sales order.
 */
export const SalesOrderShippingTracker: React.FC<SalesOrderShippingTrackerProps> = ({
  order,
}) => {
  const shipments = order.shipments || [];
  const lineItems = order.lineItems || [];

  const anyInTransit = shipments.some((s) => s.deliveryStatus === 'In-Transit');
  const allDelivered =
    shipments.length > 0 && shipments.every((s) => s.deliveryStatus === 'Delivered');

  const activeStep = resolveShippingStepIndex(order.status, order.deliveryStatus, {
    stockReserved: Boolean(order.stockReserved),
    shipmentCount: shipments.length,
    anyInTransit,
    allDelivered,
  });

  const isCancelled = normalizeStatus(order.status) === 'cancelled';
  const isReturned = normalizeStatus(order.status) === 'returned';
  const isDelivered =
    !isCancelled &&
    !isReturned &&
    (normalizeStatus(order.deliveryStatus) === 'delivered' ||
      normalizeStatus(order.status) === 'completed' ||
      normalizeStatus(order.status) === 'delivered' ||
      allDelivered);

  const stepMeta = useMemo(() => {
    const meta: Record<string, string> = {
      created: formatWhen(order.createdAt || order.issueDate),
      approved:
        normalizeStatus(order.status) === 'approved' || activeStep >= 1
          ? formatWhen(order.updatedAt)
          : '',
      processing: order.stockReservedAt ? formatWhen(order.stockReservedAt) : '',
      dispatched: shipments[0]?.dispatchedAt
        ? formatWhen(shipments[0].dispatchedAt)
        : order.dispatchedAt
          ? formatWhen(order.dispatchedAt)
          : '',
      in_transit: anyInTransit
        ? 'Courier in transit'
        : shipments.some((s) => s.deliveryStatus === 'Dispatched')
          ? 'Awaiting transit update'
          : '',
      delivered:
        shipments.find((s) => s.deliveredAt)?.deliveredAt
          ? formatWhen(shipments.find((s) => s.deliveredAt)?.deliveredAt)
          : order.deliveredAt
            ? formatWhen(order.deliveredAt)
            : isDelivered
              ? formatWhen(order.updatedAt) || 'Delivered'
              : '',
    };
    return meta;
  }, [order, shipments, activeStep, anyInTransit, isDelivered]);

  const chartData = useMemo(
    () =>
      lineItems.map((line, index) => {
        const label =
          String(line.description || `Item ${index + 1}`).trim().slice(0, 22) ||
          `Item ${index + 1}`;
        return {
          name: label,
          ordered: Number(line.qty) || 0,
          shipped: Number(line.shippedQty) || 0,
          returned: Number(line.returnedQty) || 0,
        };
      }),
    [lineItems]
  );

  const totals = useMemo(() => {
    const ordered = chartData.reduce((sum, row) => sum + row.ordered, 0);
    const shipped = chartData.reduce((sum, row) => sum + row.shipped, 0);
    const returned = chartData.reduce((sum, row) => sum + row.returned, 0);
    const pct = ordered > 0 ? Math.round((shipped / ordered) * 100) : 0;
    return { ordered, shipped, returned, pct };
  }, [chartData]);

  return (
    <section
      data-tour="sales-orders-detail-shipping-tracker"
      className="bg-white border border-zinc-300 rounded-xl p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 m-0">Shipping progress</h2>
          <p className="text-[11px] text-zinc-500 m-0 mt-1">
            Track fulfillment from approval through courier delivery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            size="small"
            label={order.status}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
          {order.deliveryStatus ? (
            <Chip
              size="small"
              variant="outlined"
              label={order.deliveryStatus}
              sx={{ fontWeight: 600, fontSize: 11 }}
            />
          ) : null}
          <Chip
            size="small"
            color={totals.pct >= 100 ? 'success' : totals.pct > 0 ? 'primary' : 'default'}
            label={`${totals.pct}% shipped`}
            sx={{ fontWeight: 700, fontSize: 11 }}
          />
        </div>
      </div>

      {(isCancelled || isReturned) && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-xs font-semibold ${
            isCancelled
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-stone-200 bg-stone-50 text-stone-700'
          }`}
        >
          {isCancelled
            ? `Order cancelled${order.cancellationReason ? ` — ${order.cancellationReason}` : ''}`
            : 'Order marked returned — RMA flow may still be in progress below.'}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* MUI vertical stepper */}
        <Box sx={{ maxWidth: 520 }}>
          <Stepper
            activeStep={isCancelled ? -1 : isDelivered ? 6 : Math.max(0, activeStep)}
            orientation="vertical"
            sx={{
              '& .MuiStepIcon-root.Mui-completed': { color: '#16a34a' },
              '& .MuiStepIcon-root.Mui-active': { color: '#09090b' },
              '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': { borderColor: '#16a34a' },
              '& .MuiStepConnector-line': { borderColor: '#e4e4e7', minHeight: 20 },
            }}
          >
            {SALES_ORDER_SHIPPING_STEPS.map((step, index) => {
              const completed = !isCancelled && (isDelivered ? true : activeStep > index);
              const active = !isCancelled && !isDelivered && activeStep === index;
              const detail = stepMeta[step.id];
              return (
                <Step key={step.id} completed={completed} active={active}>
                  <StepLabel
                    StepIconComponent={CustomStepIcon}
                    optional={
                      detail ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color: isDelivered && index === 5 ? '#16a34a' : 'text.secondary',
                            fontWeight: isDelivered && index === 5 ? 600 : 400,
                          }}
                        >
                          {detail}
                        </Typography>
                      ) : null
                    }
                  >
                    <span className="text-sm font-semibold text-zinc-950">{step.label}</span>
                  </StepLabel>
                  <StepContent TransitionProps={{ in: active || (isDelivered && index === 5) }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {step.description}
                    </Typography>
                    {index === 5 && isDelivered ? (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#16a34a',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.5,
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 14, color: '#16a34a' }} /> Order successfully delivered to customer
                      </Typography>
                    ) : null}
                    {index === 3 && shipments.length > 0 ? (
                      <ul className="m-0 pl-4 text-[11px] text-zinc-600 space-y-1">
                        {shipments.slice(0, 4).map((s) => (
                          <li key={s._id}>
                            {s.shipmentNumber}: {s.courierName} · AWB {s.trackingNumber} ·{' '}
                            {s.deliveryStatus}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </StepContent>
                </Step>
              );
            })}
          </Stepper>
        </Box>

        {/* Recharts product shipping qty chart */}
        <div className="min-h-[280px] flex flex-col">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Product shipping qty
          </div>
          {chartData.length === 0 ? (
            <p className="text-sm text-zinc-500 m-0">No line items to chart.</p>
          ) : (
            <div className="flex-1 w-full min-h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    interval={0}
                    angle={chartData.length > 4 ? -20 : 0}
                    textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                    height={chartData.length > 4 ? 56 : 30}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #e4e4e7',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ordered" name="Ordered" fill="#09090b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="shipped" name="Shipped" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="returned" name="Returned" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-600">
            <span>
              Ordered <strong className="text-zinc-950">{totals.ordered}</strong>
            </span>
            <span>
              Shipped <strong className="text-zinc-950">{totals.shipped}</strong>
            </span>
            <span>
              Returned <strong className="text-zinc-950">{totals.returned}</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
