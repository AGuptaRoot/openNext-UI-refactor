import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { crmApi } from '../../services/api';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_CURRENCIES,
  EXPENSE_PAYMENT_MODES,
  type ExpenseCreateInput,
} from '../../types/expenses';
import type { AssignableUser } from '../../types/leads';
import type { ProjectItem } from '../../types/projects';
import type { ClientOption } from '../../types/reports';
import {
  FormField,
  FormSection,
  financeFieldClass,
  financeTextAreaClass,
} from '../../components/finance/FinanceFormElements';
import { ClientSelect } from '../../components/clients/ClientSelect';
import { DocumentUploadControl } from '../../components/common/DocumentUploadControl';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const ExpenseCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const settingsCurrency = useDefaultCurrency();
  const currencyLockedRef = useRef(false);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [employees, setEmployees] = useState<AssignableUser[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [billFileName, setBillFileName] = useState('');
  const [billFileSize, setBillFileSize] = useState(0);

  const [form, setForm] = useState<ExpenseCreateInput>({
    itemName: '',
    category: 'Other',
    price: 0,
    currency: settingsCurrency,
    exchangeRate: 1,
    purchaseDate: localToday(),
    purchasedFrom: '',
    isBillable: false,
    employeeId: '',
    employeeName: '',
    projectId: initialProjectId,
    clientId: '',
    paymentMode: 'Bank Transfer',
    billUrl: '',
    bill: '',
    receiptUrl: '',
    description: '',
  });

  useEffect(() => {
    if (currencyLockedRef.current) return;
    setForm((current) => ({ ...current, currency: settingsCurrency }));
  }, [settingsCurrency]);

  useEffect(() => {
    Promise.all([
      crmApi.listProjects({ limit: 200 }),
      crmApi.getClients({ limit: 200 }),
      crmApi.getAssignableUsers(),
      crmApi.getExpenseCategories(),
    ])
      .then(([projectResponse, clientResponse, employeeResponse, categoryResponse]) => {
        const loadedProjects = projectResponse.data || [];
        setProjects(loadedProjects);
        setClients(clientResponse.data || []);
        setEmployees(employeeResponse.data || []);
        setCategories(
          categoryResponse.data?.length ? categoryResponse.data : DEFAULT_EXPENSE_CATEGORIES
        );
        if (initialProjectId) {
          const matched = loadedProjects.find((p) => p._id === initialProjectId);
          if (matched) {
            setForm((current) => ({
              ...current,
              projectId: initialProjectId,
              clientId: matched.clientId || current.clientId,
            }));
          }
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Failed to load form options')
      );
  }, [initialProjectId]);

  const update = <K extends keyof ExpenseCreateInput>(key: K, value: ExpenseCreateInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseProject = (projectId: string) => {
    const project = projects.find((item) => item._id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      clientId: project?.clientId || current.clientId,
    }));
  };

  const clearBill = () => {
    setBillFileName('');
    setBillFileSize(0);
    update('billUrl', '');
    update('bill', '');
    update('receiptUrl', '');
  };

  const resolveEmployeeName = (employeeId?: string): string => {
    if (!employeeId) return '';
    const employee = employees.find((user) => user.id === employeeId || user._id === employeeId);
    return employee?.name || employee?.displayName || '';
  };

  const save = async (submitForApproval: boolean) => {
    setError('');
    if (!form.itemName.trim()) return setError('Item name is required.');
    if (!form.category) return setError('Category is required.');
    if (!(Number(form.price) >= 0.01)) return setError('Price must be at least 0.01.');
    if (!(Number(form.exchangeRate) >= 0.0001)) return setError('Exchange rate must be at least 0.0001.');
    if (!form.purchaseDate) return setError('Purchase date is required.');
    if (
      !EXPENSE_CURRENCIES.includes(form.currency as (typeof EXPENSE_CURRENCIES)[number]) &&
      form.currency !== settingsCurrency
    ) {
      return setError('Select a valid currency.');
    }

    const employeeName = resolveEmployeeName(form.employeeId);
    const receiptLink =
      form.receiptUrl ||
      (form.billUrl && !String(form.billUrl).startsWith('data:') ? form.billUrl : '') ||
      '';

    setSaving(true);
    try {
      const created = await crmApi.createExpense({
        itemName: form.itemName.trim(),
        category: form.category,
        price: Number(form.price),
        amount: Number(form.price),
        currency: form.currency || settingsCurrency,
        exchangeRate: Number(form.exchangeRate),
        purchaseDate: form.purchaseDate,
        expenseDate: form.purchaseDate,
        purchasedFrom: form.purchasedFrom?.trim() || '',
        isBillable: Boolean(form.isBillable),
        employeeId: form.employeeId || undefined,
        employeeName,
        projectId: form.projectId || undefined,
        clientId: form.clientId || undefined,
        paymentMode: form.paymentMode || 'Bank Transfer',
        billUrl: form.billUrl || undefined,
        bill: form.bill || billFileName || undefined,
        receiptUrl: receiptLink || form.billUrl || undefined,
        description: form.description?.trim() || '',
        submit: submitForApproval,
      });
      const newId = created.data?._id;
      if (newId) {
        navigate(`/expenses/${encodeURIComponent(newId)}`);
      } else if (form.projectId) {
        navigate(`/projects/${encodeURIComponent(form.projectId)}?tab=expenses`);
      } else {
        navigate('/expenses');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create expense');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    save(false);
  };

  return (
    <div data-tour="expenses-create-form" className="flex w-full flex-col gap-5">
      <Link
        to={initialProjectId ? `/projects/${encodeURIComponent(initialProjectId)}?tab=expenses` : '/expenses'}
        data-tour="expenses-create-back"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 no-underline hover:text-zinc-950"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} /> {initialProjectId ? 'Back to Project Expenses' : 'Back to Expenses'}
      </Link>

      <div className="mb-5 pb-4 border-b border-zinc-200">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 m-0 mb-1">Finance</p>
        <h1 className="m-0 text-2xl font-bold text-zinc-950">Create Expense</h1>
        <p className="mt-1 mb-0 text-sm text-zinc-500">
          Capture purchase details, allocation, and receipt — then save as draft or submit for approval.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form id="expense-create-form" onSubmit={onSubmit} className="space-y-5">
        <div data-tour="expenses-create-item">
        <FormSection title="Item & Purchase Details">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Item name" required>
              <input
                className={financeFieldClass}
                value={form.itemName}
                onChange={(e) => update('itemName', e.target.value)}
                maxLength={200}
                placeholder="e.g. AWS Cloud Hosting"
                required
              />
            </FormField>
            <FormField label="Expense category" required>
              <select
                className={financeFieldClass}
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                required
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Price / amount" required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={financeFieldClass}
                value={form.price || ''}
                onChange={(e) => update('price', Number(e.target.value))}
                required
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Currency" required>
                <select
                  className={financeFieldClass}
                  value={form.currency}
                  onChange={(e) => {
                    currencyLockedRef.current = true;
                    update('currency', e.target.value);
                  }}
                  required
                >
                  {Array.from(
                    new Set([...EXPENSE_CURRENCIES, form.currency, settingsCurrency])
                  ).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Exchange rate" required>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  className={financeFieldClass}
                  value={form.exchangeRate}
                  onChange={(e) => update('exchangeRate', Number(e.target.value))}
                  required
                />
              </FormField>
            </div>
            <FormField label="Purchase date" required>
              <input
                type="date"
                className={financeFieldClass}
                value={form.purchaseDate}
                onChange={(e) => update('purchaseDate', e.target.value)}
                required
              />
            </FormField>
            <FormField label="Purchased from (vendor)">
              <input
                className={financeFieldClass}
                value={form.purchasedFrom || ''}
                onChange={(e) => update('purchasedFrom', e.target.value)}
                maxLength={200}
                placeholder="Merchant or supplier"
              />
            </FormField>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(form.isBillable)}
                onChange={(e) => update('isBillable', e.target.checked)}
              />
              Billable expense (reimbursable / client-billable)
            </label>
          </div>
        </FormSection>
        </div>

        <div data-tour="expenses-create-allocation">
        <FormSection title="Allocation & Payment Source">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Employee / claimant">
              <select
                className={financeFieldClass}
                value={form.employeeId || ''}
                onChange={(e) => update('employeeId', e.target.value)}
              >
                <option value="">Not assigned</option>
                {employees.map((item) => (
                  <option key={item.id || item._id} value={item.id || item._id}>
                    {item.name || item.displayName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Project (optional)">
              <select
                className={financeFieldClass}
                value={form.projectId || ''}
                onChange={(e) => chooseProject(e.target.value)}
              >
                <option value="">No project</option>
                {projects.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Client (optional)">
              <ClientSelect
                clients={clients}
                value={form.clientId || ''}
                allowClear
                placeholder="No client"
                onChange={(nextId) => update('clientId', nextId)}
              />
            </FormField>
            <FormField label="Payment mode">
              <select
                className={financeFieldClass}
                value={form.paymentMode || 'Bank Transfer'}
                onChange={(e) => update('paymentMode', e.target.value)}
              >
                {EXPENSE_PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>
        </div>

        <div data-tour="expenses-create-receipt">
        <FormSection title="Bill Receipt & Description">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="text-[11px] font-semibold text-zinc-500 uppercase mb-1.5">
                Bill / invoice receipt
              </div>
              <DocumentUploadControl
                folder="expenses"
                mode="button"
                buttonLabel="Choose file"
                uploadButtonLabel="Upload document"
                hint="PDF, Office, images — max 20MB"
                currentFileName={billFileName || null}
                currentUrl={form.billUrl || form.receiptUrl || null}
                onUploaded={(res) => {
                  setError('');
                  setBillFileName(res.fileName || res.originalName || 'receipt');
                  setBillFileSize(res.fileSize || 0);
                  const url = res.url || res.fileUrl || '';
                  setForm((current) => ({
                    ...current,
                    billUrl: url,
                    bill: res.fileName || res.originalName || 'receipt',
                    receiptUrl: url,
                  }));
                }}
                onError={(msg) => setError(msg)}
              />
              {billFileName && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="text-sm text-zinc-700">
                    Attached: <span className="font-semibold">{billFileName}</span>
                    {billFileSize > 0 && (
                      <span className="text-zinc-500">
                        {' '}
                        ({billFileSize < 1024
                          ? `${billFileSize} B`
                          : billFileSize < 1024 * 1024
                            ? `${(billFileSize / 1024).toFixed(1)} KB`
                            : `${(billFileSize / (1024 * 1024)).toFixed(1)} MB`}
                        )
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearBill}
                    className="h-8 px-3 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 cursor-pointer"
                  >
                    Remove Bill
                  </button>
                </div>
              )}
            </div>

            <FormField label="Description / purpose" wide>
              <textarea
                className={financeTextAreaClass}
                rows={4}
                maxLength={2000}
                value={form.description || ''}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Business justification or deliverable notes"
              />
            </FormField>
          </div>
        </FormSection>
        </div>

        <div data-tour="expenses-create-actions" className="flex flex-wrap justify-end gap-3 pt-1">
          <Link
            to="/expenses"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 no-underline bg-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            data-tour="expenses-save-draft-btn"
            disabled={saving}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            data-tour="expenses-submit-btn"
            disabled={saving}
            onClick={() => save(true)}
            className="h-10 rounded-lg border-0 bg-zinc-950 px-5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Submitting…' : 'Save & Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
};
