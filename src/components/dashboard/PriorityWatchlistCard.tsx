import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { DashboardData, InvoiceItem } from '../../types/dashboard';
import { dashboardListPath } from '../../utils/dashboardNavigation';
import { formatCrmMoney, getRuntimeDefaultCurrency } from '../../utils/currency';

interface PriorityWatchlistCardProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

function invoiceIdOf(inv: InvoiceItem): string {
  return String(inv._id || inv.id || '').trim();
}

export const PriorityWatchlistCard: React.FC<PriorityWatchlistCardProps> = ({
  data,
  onNavigateUnmigrated,
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'invoices' | 'orders'>('invoices');
  const currency = data.defaultCurrency || getRuntimeDefaultCurrency();
  const invoices: InvoiceItem[] = data.unpaidInvoicesList || [];

  const openInvoice = (inv: InvoiceItem) => {
    const id = invoiceIdOf(inv);
    if (id) {
      navigate(`/invoices/${encodeURIComponent(id)}`);
      return;
    }
    onNavigateUnmigrated('Invoices');
  };

  const openInvoicesList = () => {
    const hasOverdue = invoices.some((inv) => inv.isOverdue || inv.status === 'Overdue');
    navigate(hasOverdue ? dashboardListPath('invoicesOverdue') : dashboardListPath('invoicesUnpaid'));
  };

  return (
    <div
      data-tour="dashboard-watchlist"
      className="bg-white border border-zinc-300 rounded-xl p-6 flex-1 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-950 m-0 leading-tight">
              Recent Invoices & Orders
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-1">
              Pending settlements and outstanding balances.
            </p>
          </div>

          <div className="bg-zinc-100 p-1 rounded-lg border border-zinc-200 flex items-center">
            <button
              type="button"
              onClick={() => setTab('invoices')}
              className={`text-[11.5px] px-2.5 py-1 rounded-md border-none cursor-pointer transition-colors duration-150 ${
                tab === 'invoices'
                  ? 'bg-zinc-950 text-white font-semibold'
                  : 'bg-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
              }`}
            >
              Invoices ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('orders')}
              className={`text-[11.5px] px-2.5 py-1 rounded-md border-none cursor-pointer transition-colors duration-150 ${
                tab === 'orders'
                  ? 'bg-zinc-950 text-white font-semibold'
                  : 'bg-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
              }`}
            >
              Orders
            </button>
          </div>
        </div>

        {tab === 'invoices' ? (
          invoices.length === 0 ? (
            <div className="py-10 text-center">
              <ReceiptOutlinedIcon sx={{ fontSize: 32, color: '#a1a1aa' }} className="mb-1" />
              <p className="text-xs text-zinc-500 m-0">
                All customer invoices are fully settled.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {invoices.slice(0, 5).map((inv, idx) => {
                const isOverdue = inv.isOverdue || inv.status === 'overdue';
                return (
                  <div
                    key={invoiceIdOf(inv) || inv.invoiceNumber || idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => openInvoice(inv)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openInvoice(inv);
                      }
                    }}
                    className="p-3 rounded-lg border border-zinc-300 bg-white hover:border-zinc-950 hover:bg-zinc-50/70 flex items-center justify-between cursor-pointer transition-all duration-150"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold font-mono text-zinc-950">
                          {inv.invoiceNumber}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                            isOverdue
                              ? 'bg-zinc-100 text-red-600 border-zinc-200'
                              : 'bg-zinc-100 text-amber-600 border-zinc-200'
                          }`}
                        >
                          {isOverdue ? 'Overdue' : 'Unpaid'}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 block truncate">
                        {inv.clientName} • Due{' '}
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString()
                          : 'Pending'}
                      </span>
                    </div>

                    <div className="text-xs font-bold font-mono text-zinc-950 flex-shrink-0">
                      {formatCrmMoney(inv.balanceDue ?? inv.total, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="py-10 text-center">
            <p className="text-xs text-zinc-500 m-0">
              No pending sales orders requiring fulfillment.
            </p>
            <button
              type="button"
              onClick={() => navigate(dashboardListPath('salesOrders'))}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
            >
              Open Sales Orders
              <ArrowForwardIcon sx={{ fontSize: 13 }} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-200">
        <span className="text-xs text-zinc-500">
          Open balances:{' '}
          <strong className="text-zinc-950">{data.unpaidInvoices || 0} unpaid invoices</strong>
        </span>
        <button
          type="button"
          onClick={openInvoicesList}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
        >
          <span>Manage Invoices</span>
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  );
};
