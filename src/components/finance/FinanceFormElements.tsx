import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DocumentUploadControl } from '../common/DocumentUploadControl';

export const financeFieldClass =
  'h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white';
export const financeTextAreaClass =
  'px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border bg-white resize-y';

export const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'SGD', 'JPY'] as const;
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;
export const PAYMENT_GATEWAYS = [
  '',
  'Razorpay',
  'Stripe',
  'PayPal',
  'Bank Transfer / Wire',
  'Cash',
  'Cheque',
  'Square',
  'Authorize.Net',
  'Other',
] as const;

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-zinc-300 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-950 m-0 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function FormField({
  label,
  required,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold text-zinc-500 uppercase">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

export interface EditableLine {
  key: string;
  name: string;
  description: string;
  sku: string;
  qty: number;
  rate: number;
  tax: number;
  fileUrl?: string;
  fileName?: string;
}

export function newEditableLine(): EditableLine {
  return {
    key: `line_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: '',
    description: '',
    sku: '',
    qty: 1,
    rate: 0,
    tax: 18,
    fileUrl: '',
    fileName: '',
  };
}

interface LineItemsEditorProps {
  lines: EditableLine[];
  setLines: React.Dispatch<React.SetStateAction<EditableLine[]>>;
  orderMode?: boolean;
  showFileUrl?: boolean;
}

export function LineItemsEditor({
  lines,
  setLines,
  orderMode = false,
  showFileUrl = false,
}: LineItemsEditorProps) {
  const update = (key: string, patch: Partial<EditableLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const remove = (key: string) =>
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.key !== key)));

  const headings = orderMode
    ? ['Description *', 'SKU', 'Qty *', 'Rate *', 'Tax %', 'Amount', ...(showFileUrl ? ['Attachment'] : []), '']
    : ['Name *', 'Description', 'Qty *', 'Rate *', 'Tax %', 'Amount', ...(showFileUrl ? ['Attachment'] : []), ''];

  return (
    <FormSection title="Line items">
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setLines((current) => [...current, newEditableLine()])}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer"
        >
          <AddIcon sx={{ fontSize: 14 }} /> Add line
        </button>
      </div>
      <div className="overflow-x-auto border border-zinc-200 rounded-lg">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {headings.map((heading, idx) => (
                <th
                  key={`${heading}-${idx}`}
                  className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-zinc-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} className="border-b border-zinc-100">
                <td className="p-2">
                  <input
                    className={financeFieldClass}
                    value={orderMode ? line.description : line.name}
                    onChange={(event) =>
                      update(
                        line.key,
                        orderMode ? { description: event.target.value } : { name: event.target.value }
                      )
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    className={financeFieldClass}
                    value={orderMode ? line.sku : line.description}
                    onChange={(event) =>
                      update(
                        line.key,
                        orderMode ? { sku: event.target.value } : { description: event.target.value }
                      )
                    }
                  />
                </td>
                <td className="p-2 w-24">
                  <input
                    className={financeFieldClass}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.qty}
                    onChange={(event) => update(line.key, { qty: Number(event.target.value) })}
                  />
                </td>
                <td className="p-2 w-32">
                  <input
                    className={financeFieldClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(event) => update(line.key, { rate: Number(event.target.value) })}
                  />
                </td>
                <td className="p-2 w-24">
                  <input
                    className={financeFieldClass}
                    type="number"
                    min="0"
                    max="100"
                    value={line.tax}
                    onChange={(event) => update(line.key, { tax: Number(event.target.value) })}
                  />
                </td>
                <td className="p-2 text-xs font-semibold text-zinc-900 whitespace-nowrap">
                  {(line.qty * line.rate).toLocaleString('en-IN')}
                </td>
                {showFileUrl && (
                  <td className="p-2 min-w-[160px]">
                    <div className="flex flex-col gap-1">
                      <DocumentUploadControl
                        folder="quotations"
                        compact
                        mode="auto"
                        buttonLabel="Choose"
                        currentFileName={line.fileName || null}
                        currentUrl={line.fileUrl || null}
                        onUploaded={(res) =>
                          update(line.key, {
                            fileUrl: res.url || res.fileUrl || '',
                            fileName: res.fileName || res.originalName || 'file',
                          })
                        }
                      />
                    </div>
                  </td>
                )}
                <td className="p-2 w-12">
                  <button
                    type="button"
                    disabled={lines.length === 1}
                    onClick={() => remove(line.key)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white text-red-600 cursor-pointer disabled:opacity-30"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormSection>
  );
}

export function CreatePageHeader({
  title,
  backLabel,
  backPath,
  saving,
  formId,
}: {
  title: string;
  backLabel: string;
  backPath: string;
  saving: boolean;
  formId: string;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-200">
      <div>
        <a href={`#${backPath}`} className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950">
          ← {backLabel}
        </a>
        <h1 className="text-2xl font-bold text-zinc-950 m-0 mt-2">{title}</h1>
      </div>
      <button
        type="submit"
        form={formId}
        disabled={saving}
        className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer disabled:opacity-50"
      >
        {saving ? 'Saving…' : `Save ${title.replace('New ', '')}`}
      </button>
    </header>
  );
}
