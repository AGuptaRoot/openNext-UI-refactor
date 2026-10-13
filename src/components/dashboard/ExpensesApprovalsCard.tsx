import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { DashboardData } from '../../types/dashboard';
import { dashboardListPath } from '../../utils/dashboardNavigation';

interface ExpensesApprovalsCardProps {
  data: DashboardData;
  onNavigateUnmigrated: (moduleName: string) => void;
}

function formatMoney(amount: number | undefined, currency = 'INR'): string {
  const num = Number(amount || 0);
  return `${currency} ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export const ExpensesApprovalsCard: React.FC<ExpensesApprovalsCardProps> = ({
  data,
  onNavigateUnmigrated: _onNavigateUnmigrated,
}) => {
  void _onNavigateUnmigrated;
  const navigate = useNavigate();
  const currency = data.defaultCurrency || 'INR';
  const pendingApprovals = data.pendingExpenseApprovals || 0;
  const approvedMonth = data.approvedExpensesThisMonth || 0;

  if (pendingApprovals === 0 && approvedMonth === 0) return null;

  return (
    <div className="bg-white border border-zinc-300 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center flex-shrink-0">
            <ReceiptLongIcon sx={{ fontSize: 18 }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-950 m-0">
              Expenses & Approvals Queue
            </h3>
            <p className="text-xs text-zinc-500 m-0 mt-0.5">
              Pending team reimbursements and monthly operational expenditure.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              pendingApprovals > 0
                ? dashboardListPath('expensesPending')
                : dashboardListPath('expensesApproved')
            )
          }
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
        >
          <span>Review Claims</span>
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => navigate(dashboardListPath('expensesPending'))}
          className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between cursor-pointer text-left hover:border-zinc-950"
        >
          <div>
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Claims Pending Approval
            </span>
            <div className="text-xl font-bold font-mono text-zinc-950">
              {pendingApprovals}
            </div>
          </div>
          {pendingApprovals > 0 ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-red-600">
              Action Required
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-emerald-600">
              Clear
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate(dashboardListPath('expensesApproved'))}
          className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between cursor-pointer text-left hover:border-zinc-950"
        >
          <div>
            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
              Approved This Month
            </span>
            <div className="text-xl font-bold font-mono text-zinc-950">
              {formatMoney(approvedMonth, currency)}
            </div>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-500">
            Disbursed
          </span>
        </button>
      </div>
    </div>
  );
};
