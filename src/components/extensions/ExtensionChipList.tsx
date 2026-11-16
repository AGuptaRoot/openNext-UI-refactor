import React, { useMemo, useState } from 'react';
import { List, Plus, Search, X } from 'lucide-react';

/** From this many values on, the card shows a search box (short lists stay as they were). */
export const CHIP_SEARCH_FROM = 12;

/**
 * Indexes (in `items`) of the values matching `query` — case and extra spaces ignored.
 * An empty query matches everything.
 */
export function matchChipItems(items: string[], query: string): number[] {
  const q = query.trim().replace(/\s+/g, ' ').toLowerCase();
  const out: number[] = [];
  items.forEach((item, index) => {
    if (!q || item.replace(/\s+/g, ' ').toLowerCase().includes(q)) out.push(index);
  });
  return out;
}

/**
 * Editable list of text values for an extension `list` setting. Same look and
 * behaviour as Settings → Leads → Lead Sources (chips, Add, bulk edit), so an
 * extension's masters feel native. Long lists (e.g. hundreds of imported cities)
 * stay compact: the chips scroll inside the card and a search box filters them.
 */
export const ExtensionChipList: React.FC<{
  title: string;
  description?: string;
  value: unknown;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string[]) => void;
}> = ({ title, description, value, placeholder, disabled = false, onChange }) => {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  /** The bulk box keeps its own text, so a new (still empty) line is not dropped while typing. */
  const [bulkText, setBulkText] = useState('');

  const items = useMemo(
    () => (Array.isArray(value) ? value : []).map((item) => String(item ?? '').trim()).filter(Boolean),
    [value]
  );
  const searchable = items.length >= CHIP_SEARCH_FROM;
  const activeQuery = searchable ? query : '';
  const shown = useMemo(() => matchChipItems(items, activeQuery), [items, activeQuery]);

  const add = () => {
    const next = draft.trim().replace(/\s+/g, ' ');
    if (!next) return;
    const existing = items.find((item) => item.toLowerCase() === next.toLowerCase());
    if (existing) {
      setNotice(`"${existing}" is already in the list.`);
      if (searchable) setQuery(existing);
      return;
    }
    onChange([...items, next]);
    if (showBulk) setBulkText([...items, next].join('\n'));
    setNotice('');
    setDraft('');
  };

  const remove = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    if (showBulk) setBulkText(next.join('\n'));
  };

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 rounded-xl border border-zinc-300 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <List className="h-[18px] w-[18px] shrink-0" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-sm font-bold text-zinc-950">{title}</h3>
            {description && <p className="mb-0 mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
          {items.length}
        </span>
      </div>

      {searchable && (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="search"
              className="h-9 w-full box-border rounded-lg border border-zinc-300 bg-white pl-8 pr-8 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              value={query}
              placeholder={`Search ${items.length} values…`}
              aria-label={`Search ${title}`}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <p className="m-0 text-[11px] text-zinc-500" aria-live="polite">
            {activeQuery.trim() ? `Showing ${shown.length} of ${items.length}` : `${items.length} values · scroll to see all`}
          </p>
        </div>
      )}

      <div className="min-h-[72px] max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
        {items.length === 0 ? (
          <p className="m-0 py-4 text-center text-xs text-zinc-400">No values yet — add the first one below.</p>
        ) : shown.length === 0 ? (
          <p className="m-0 py-4 text-center text-xs text-zinc-400">No value matches "{query.trim()}".</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {shown.map((index) => {
              const item = items[index];
              return (
                <span
                  key={`${item}-${index}`}
                  title={item}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-white py-0.5 pl-2.5 pr-1 text-xs font-medium text-zinc-800"
                >
                  <span className="max-w-[180px] truncate">{item}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => remove(index)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white cursor-pointer disabled:opacity-40"
                    aria-label={`Remove ${item}`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className="h-9 w-full min-w-0 box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            value={draft}
            disabled={disabled}
            placeholder={placeholder || 'Add value…'}
            aria-label={`Add to ${title}`}
            onChange={(e) => {
              setDraft(e.target.value);
              if (notice) setNotice('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            onClick={add}
            disabled={disabled}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 bg-zinc-950 px-3 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        </div>
        {notice && (
          <p className="m-0 text-[11px] font-medium text-amber-700" role="status">
            {notice}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            if (!showBulk) setBulkText(items.join('\n'));
            setShowBulk((open) => !open);
          }}
          className="self-start border-0 bg-transparent p-0 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"
        >
          {showBulk ? 'Hide bulk edit' : 'Bulk edit (one per line)'}
        </button>
        {showBulk && (
          <textarea
            className={`${items.length > 20 ? 'h-56' : 'h-24'} w-full box-border resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400`}
            value={bulkText}
            disabled={disabled}
            onChange={(e) => {
              setBulkText(e.target.value);
              onChange(e.target.value.split('\n').map((line) => line.trim()).filter(Boolean));
            }}
            placeholder="One value per line"
          />
        )}
      </div>
    </div>
  );
};
