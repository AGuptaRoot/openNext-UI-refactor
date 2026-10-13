import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import type { QuotationTemplateItem } from '../../types/quotations';

export const QuotationTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [items, setItems] = useState<QuotationTemplateItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmApi.listQuotationTemplates({ search: search || undefined });
      setItems(response.data || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const remove = async (id: string) => {
    if (!(await confirm({ message: 'Delete this quotation template?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await crmApi.deleteQuotationTemplate(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delete failed');
    }
  };

  return (
    <div data-tour="quotations-templates-landing" className="flex flex-col gap-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <Link
            to="/quotations"
            className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-950"
          >
            ← Quotations
          </Link>
          <h1 className="text-2xl font-bold text-zinc-950 m-0 mt-2">Quotation Templates</h1>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Reusable proposal packages for retainers, fixed scope, and consulting.
          </p>
        </div>
        <button
          type="button"
          data-tour="quotations-templates-new-btn"
          onClick={() => navigate('/quotation-templates/create')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-950 bg-zinc-950 text-white cursor-pointer"
        >
          <AddIcon sx={{ fontSize: 16 }} /> New Template
        </button>
      </header>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
        className="h-9 max-w-xl px-3 text-sm border border-zinc-200 rounded-lg"
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading templates…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No templates yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Currency</th>
                  <th className="px-4 py-3 text-left">Tax mode</th>
                  <th className="px-4 py-3 text-left">Lines</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-zinc-500 mt-0.5">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{item.category || 'General'}</td>
                    <td className="px-4 py-3">{item.currency}</td>
                    <td className="px-4 py-3">{item.taxCalculation?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{item.lineItems?.length || 0}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => remove(item._id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-red-600 cursor-pointer"
                        aria-label={`Delete ${item.name}`}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
