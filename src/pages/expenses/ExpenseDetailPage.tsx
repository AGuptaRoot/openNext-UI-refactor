import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_CURRENCIES,
  EXPENSE_PAYMENT_MODES,
  formatExpenseMoney,
  type ExpenseItem,
} from '../../types/expenses';
import type { AssignableUser } from '../../types/leads';
import type { ProjectItem } from '../../types/projects';
import {
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import { displayLabel, displayUserLabel } from '../../utils/displayLabels';
import { getRuntimeDefaultCurrency } from '../../utils/currency';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-zinc-100 text-zinc-700',
    Submitted: 'bg-amber-50 text-amber-800',
    Approved: 'bg-emerald-50 text-emerald-800',
    Rejected: 'bg-red-50 text-red-800',
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

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

type EditFormState = {
  itemName: string;
  price: number;
  currency: string;
  purchaseDate: string;
  category: string;
  purchasedFrom: string;
  employeeId: string;
  paymentMode: string;
  projectId: string;
  isBillable: boolean;
  bill: string;
  description: string;
};

function toEditForm(item: ExpenseItem): EditFormState {
  return {
    itemName: item.itemName || item.title || '',
    price: Number(item.price || item.amount || 0),
    currency: item.currency || 'INR',
    purchaseDate: toDateInput(item.purchaseDate || item.expenseDate),
    category: item.category || 'Other',
    purchasedFrom: item.purchasedFrom || '',
    employeeId: item.employeeId || '',
    paymentMode: String(item.paymentMode || 'Bank Transfer'),
    projectId: item.projectId || '',
    isBillable: Boolean(item.isBillable),
    bill: item.bill || item.billUrl || item.receiptUrl || '',
    description: item.description || item.notes || '',
  };
}

export const ExpenseDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, isClient } = useAuth();
  const { confirm } = useDialog();

  const canWrite = hasPermission('crm.expenses.write') && !isClient;
  const canApprove = hasPermission('crm.expenses.approve') && !isClient;
  const canDelete = hasPermission('crm.expenses.delete') && !isClient;

  const [expense, setExpense] = useState<ExpenseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [employees, setEmployees] = useState<AssignableUser[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await crmApi.getExpense(id);
      setExpense(response.data);
      setEditForm(toEditForm(response.data));
      setError('');
    } catch (reason) {
      setExpense(null);
      setError(reason instanceof Error ? reason.message : 'Failed to load expense');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      crmApi.listProjects({ limit: 200 }),
      crmApi.getAssignableUsers(),
      crmApi.getExpenseCategories(),
    ])
      .then(([projectRes, employeeRes, categoryRes]) => {
        setProjects(projectRes.data || []);
        setEmployees(employeeRes.data || []);
        setCategories(categoryRes.data?.length ? categoryRes.data : DEFAULT_EXPENSE_CATEGORIES);
      })
      .catch(() => {
        /* options are best-effort for edit mode */
      });
  }, []);

  const receiptUrl = useMemo(() => {
    if (!expense) return '';
    const url = expense.bill || expense.billUrl || expense.receiptUrl || '';
    return url && !String(url).startsWith('data:') ? String(url) : '';
  }, [expense]);

  const canEditFields =
    canWrite &&
    expense &&
    !expense.isArchived &&
    (expense.status === 'Draft' || expense.status === 'Rejected');

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await action();
      setInfo(successMessage);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    if (!expense || !canEditFields) return;
    setEditForm(toEditForm(expense));
    setEditing(true);
  };

  const cancelEdit = () => {
    if (expense) setEditForm(toEditForm(expense));
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!expense || !editForm || !canEditFields) return;
    if (!editForm.itemName.trim() || !(Number(editForm.price) > 0) || !editForm.purchaseDate || !editForm.category) {
      setError('Item name, category, purchase date, and a valid amount are required.');
      return;
    }
    const employee = employees.find(
      (user) => user.id === editForm.employeeId || user._id === editForm.employeeId
    );
    setBusy(true);
    setError('');
    try {
      await crmApi.updateExpense(expense._id, {
        itemName: editForm.itemName.trim(),
        price: Number(editForm.price),
        amount: Number(editForm.price),
        currency: editForm.currency,
        purchaseDate: editForm.purchaseDate,
        expenseDate: editForm.purchaseDate,
        category: editForm.category,
        purchasedFrom: editForm.purchasedFrom.trim(),
        employeeId: editForm.employeeId || undefined,
        employeeName: employee?.name || undefined,
        paymentMode: editForm.paymentMode,
        projectId: editForm.projectId || undefined,
        isBillable: editForm.isBillable,
        bill: editForm.bill.trim(),
        receiptUrl: editForm.bill.trim(),
        description: editForm.description.trim(),
      });
      setEditing(false);
      setInfo('Expense updated.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to update expense');
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!expense || !canApprove) return;
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    await runAction(
      () => crmApi.rejectExpense(expense._id, { reason: rejectReason.trim() }),
      'Expense rejected.'
    );
    setRejectOpen(false);
    setRejectReason('');
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-zinc-500">Loading expense…</div>;
  }

  if (!expense) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500 mb-4">{error || 'Expense not found.'}</p>
        <Link to="/expenses" className="text-sm font-semibold text-zinc-950 no-underline">
          ← Back to expenses
        </Link>
      </div>
    );
  }

  return (
    <div data-tour="expenses-detail" className="flex flex-col gap-5">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <Link
            to="/expenses"
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950"
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} />
            Expenses
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-950 m-0 tracking-tight">
              {displayLabel(expense.expenseNo)}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(expense.status)}`}
            >
              {expense.status}
            </span>
            {expense.isArchived && (
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
                Archived
              </span>
            )}
            {expense.isBilled && (
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                Billed
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-zinc-600 m-0">
            {expense.itemName || expense.title || 'Expense detail'}
          </p>
        </div>

        <div data-tour="expenses-detail-actions" className="flex flex-wrap gap-2 shrink-0">
          {canEditFields && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={startEdit}
              className="h-9 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Edit
            </button>
          )}
          {canEditFields && editing && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                className="h-9 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="h-9 px-3 rounded-lg bg-zinc-950 text-white text-xs font-semibold border-0 cursor-pointer disabled:opacity-50"
              >
                Save changes
              </button>
            </>
          )}
          {canWrite &&
            !expense.isArchived &&
            (expense.status === 'Draft' || expense.status === 'Rejected') && (
              <button
                type="button"
                disabled={busy || editing}
                onClick={() => runAction(() => crmApi.submitExpense(expense._id), 'Expense submitted.')}
                className="h-9 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Submit
              </button>
            )}
          {canApprove && !expense.isArchived && expense.status === 'Submitted' && (
            <>
              <button
                type="button"
                disabled={busy || editing}
                onClick={() => runAction(() => crmApi.approveExpense(expense._id), 'Expense approved.')}
                className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy || editing}
                onClick={() => {
                  setRejectOpen(true);
                  setRejectReason('');
                }}
                className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {canWrite && expense.status === 'Approved' && !expense.isArchived && (
            <button
              type="button"
              disabled={busy || editing}
              onClick={() => runAction(() => crmApi.archiveExpense(expense._id), 'Expense archived.')}
              className="h-9 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Archive
            </button>
          )}
          {canWrite && expense.isArchived && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => crmApi.restoreExpense(expense._id), 'Expense restored.')}
              className="h-9 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Restore
            </button>
          )}
          {canDelete && expense.status === 'Draft' && !expense.isArchived && (
            <button
              type="button"
              disabled={busy || editing}
              onClick={async () => {
                if (
                  !(await confirm({
                    message: `Delete draft expense "${expense.itemName || expense.expenseNo}"?`,
                    tone: 'danger',
                    confirmLabel: 'Delete',
                  }))
                ) {
                  return;
                }
                setBusy(true);
                try {
                  await crmApi.deleteExpense(expense._id);
                  navigate('/expenses');
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : 'Delete failed');
                  setBusy(false);
                }
              }}
              className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {info ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </div>
      ) : null}

      {expense.status === 'Rejected' && expense.rejectionReason ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-semibold">Rejection reason:</span> {expense.rejectionReason}
        </div>
      ) : null}

      {editing && editForm ? (
        <section className="bg-white border border-zinc-300 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 md:col-span-2">
            Item name
            <input
              className={financeFieldClass}
              value={editForm.itemName}
              onChange={(e) => setEditForm((f) => (f ? { ...f, itemName: e.target.value } : f))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Amount
            <input
              type="number"
              min={0}
              step="0.01"
              className={financeFieldClass}
              value={editForm.price || ''}
              onChange={(e) => setEditForm((f) => (f ? { ...f, price: Number(e.target.value) } : f))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Currency
            <select
              className={financeFieldClass}
              value={editForm.currency}
              onChange={(e) => setEditForm((f) => (f ? { ...f, currency: e.target.value } : f))}
            >
              {EXPENSE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Purchase date
            <input
              type="date"
              className={financeFieldClass}
              value={editForm.purchaseDate}
              onChange={(e) => setEditForm((f) => (f ? { ...f, purchaseDate: e.target.value } : f))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Category
            <select
              className={financeFieldClass}
              value={editForm.category}
              onChange={(e) => setEditForm((f) => (f ? { ...f, category: e.target.value } : f))}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Vendor
            <input
              className={financeFieldClass}
              value={editForm.purchasedFrom}
              onChange={(e) => setEditForm((f) => (f ? { ...f, purchasedFrom: e.target.value } : f))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Claimant
            <select
              className={financeFieldClass}
              value={editForm.employeeId}
              onChange={(e) => setEditForm((f) => (f ? { ...f, employeeId: e.target.value } : f))}
            >
              <option value="">—</option>
              {employees.map((user) => (
                <option key={user.id || user._id} value={user.id || user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Payment mode
            <select
              className={financeFieldClass}
              value={editForm.paymentMode}
              onChange={(e) => setEditForm((f) => (f ? { ...f, paymentMode: e.target.value } : f))}
            >
              {EXPENSE_PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
            Project
            <select
              className={financeFieldClass}
              value={editForm.projectId}
              onChange={(e) => setEditForm((f) => (f ? { ...f, projectId: e.target.value } : f))}
            >
              <option value="">—</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 mt-6">
            <input
              type="checkbox"
              checked={editForm.isBillable}
              onChange={(e) => setEditForm((f) => (f ? { ...f, isBillable: e.target.checked } : f))}
            />
            Billable to client
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 md:col-span-2">
            Upload bill / receipt
            <DocumentUploadControl
              folder="expenses"
              mode="button"
              buttonLabel="Choose file"
              uploadButtonLabel="Upload document"
              currentUrl={editForm.bill || null}
              onUploaded={(res) => {
                const url = res.url || res.fileUrl || '';
                setEditForm((f) => (f ? { ...f, bill: url } : f));
              }}
              onError={(msg) => setError(msg)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500 md:col-span-2">
            Description
            <textarea
              className={financeTextAreaClass}
              rows={4}
              value={editForm.description}
              onChange={(e) => setEditForm((f) => (f ? { ...f, description: e.target.value } : f))}
            />
          </label>
        </section>
      ) : (
        <section
          data-tour="expenses-detail-sections"
          className="grid grid-cols-1 xl:grid-cols-3 gap-4"
        >
          <div
            data-tour="expenses-detail-overview"
            className="xl:col-span-2 bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4"
          >
            <h2 className="text-sm font-bold text-zinc-950 m-0 uppercase tracking-wide">Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Item</div>
                <div className="mt-0.5 font-semibold text-zinc-950">{expense.itemName || expense.title || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Amount</div>
                <div className="mt-0.5 font-semibold text-zinc-950">
                  {formatExpenseMoney(Number(expense.price || expense.amount || 0), expense.currency)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Category</div>
                <div className="mt-0.5 text-zinc-800">{expense.category || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Purchase date</div>
                <div className="mt-0.5 text-zinc-800">{formatDate(expense.purchaseDate || expense.expenseDate)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Vendor</div>
                <div className="mt-0.5 text-zinc-800">{expense.purchasedFrom || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Payment mode</div>
                <div className="mt-0.5 text-zinc-800">{expense.paymentMode || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Claimant</div>
                <div className="mt-0.5 text-zinc-800">{displayUserLabel(expense.employeeName, expense.employeeId)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Billable</div>
                <div className="mt-0.5 text-zinc-800">{expense.isBillable ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Project</div>
                <div className="mt-0.5 text-zinc-800">
                  {expense.projectId ? (
                    <Link
                      to={`/projects/${expense.projectId}`}
                      className="font-semibold text-zinc-950 no-underline hover:underline"
                    >
                      {displayLabel(expense.projectName)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Client</div>
                <div className="mt-0.5 text-zinc-800">
                  {expense.clientId ? (
                    <Link
                      to={`/clients/${expense.clientId}`}
                      className="font-semibold text-zinc-950 no-underline hover:underline"
                    >
                      {displayLabel(expense.clientName)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            </div>

            {(expense.description || expense.notes) && (
              <div className="pt-3 border-t border-zinc-100">
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Description</div>
                <p className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap m-0">
                  {expense.description || expense.notes}
                </p>
              </div>
            )}
          </div>

          <div
            data-tour="expenses-detail-timeline"
            className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4"
          >
            <h2 className="text-sm font-bold text-zinc-950 m-0 uppercase tracking-wide">Timeline</h2>
            <dl className="m-0 grid gap-3 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-zinc-400">Created</dt>
                <dd className="m-0 mt-0.5 text-zinc-800">{formatDateTime(expense.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-zinc-400">Submitted</dt>
                <dd className="m-0 mt-0.5 text-zinc-800">{formatDateTime(expense.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-zinc-400">Approved</dt>
                <dd className="m-0 mt-0.5 text-zinc-800">{formatDateTime(expense.approvedAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-zinc-400">Rejected</dt>
                <dd className="m-0 mt-0.5 text-zinc-800">{formatDateTime(expense.rejectedAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-zinc-400">Updated</dt>
                <dd className="m-0 mt-0.5 text-zinc-800">{formatDateTime(expense.updatedAt)}</dd>
              </div>
            </dl>

            <div className="pt-3 border-t border-zinc-100">
              <div className="text-[11px] font-semibold uppercase text-zinc-400 mb-2">Receipt</div>
              {receiptUrl ? (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-zinc-950 hover:underline"
                >
                  Open attachment
                </a>
              ) : (
                <span className="text-sm text-zinc-500">No receipt uploaded</span>
              )}
            </div>

            {expense.billedInvoiceId ? (
              <div className="pt-3 border-t border-zinc-100">
                <div className="text-[11px] font-semibold uppercase text-zinc-400 mb-1">Billed invoice</div>
                <Link
                  to={`/invoices/${expense.billedInvoiceId}`}
                  className="text-sm font-semibold text-zinc-950 no-underline hover:underline"
                >
                  {displayLabel(expense.billedInvoiceNo)}
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setRejectOpen(false)}>
          <div
            className="w-full max-w-md h-full bg-white border-l border-zinc-200 p-5 flex flex-col gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold m-0">Reject expense</h3>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-zinc-500">
              Reason
              <textarea
                className={financeTextAreaClass}
                rows={5}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this expense being rejected?"
              />
            </label>
            <div className="mt-auto flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="h-9 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitReject}
                className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
