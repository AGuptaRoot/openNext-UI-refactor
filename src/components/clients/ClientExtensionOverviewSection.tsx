import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  loadFieldLogic,
  resolveExtensionFields,
  type ExtensionFieldDef,
} from '../extensions/ExtensionFieldsSlot';
import type { ExtensionClientOverviewSection as SectionDef } from '../../hooks/useExtensions';

export interface ClientExtensionOverviewSectionProps {
  section: SectionDef;
  /** Source lead's extension bag, read through Company.leadId. */
  extension: Record<string, unknown> | null;
  leadId: string | null;
  loading?: boolean;
}

type DisplayField = { label: string; value: string; mono?: boolean };
type DisplaySection = { title: string; fields: DisplayField[] };

const EMPTY = '—';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function humanize(key: string): string {
  return String(key || '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Scalars and scalar arrays only. An object never becomes JSON on screen —
 * it degrades to a dash, because a readable fallback is better than a dump.
 */
function formatScalar(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .filter((v) => v != null && v !== '' && typeof v !== 'object')
      .map((v) => (typeof v === 'string' ? humanize(v) : String(v)))
      .join(', ');
  }
  return '';
}

/**
 * Fallback used when the extension ships no `toDisplaySections`.
 * Drives labels off the field schema where available, and renders the bag's
 * own section structure otherwise. Still never prints JSON.
 */
function fallbackSections(
  bag: Record<string, unknown>,
  fields: ExtensionFieldDef[]
): DisplaySection[] {
  const labelFor = (key: string) => {
    const id = String(key).toLowerCase();
    const field = fields.find((f) => String(f.id).toLowerCase() === id);
    return field?.label || humanize(key);
  };

  const optionLabel = (key: string, value: unknown) => {
    const id = String(key).toLowerCase();
    const field = fields.find((f) => String(f.id).toLowerCase() === id);
    const options = field?.options || [];
    if (!options.length) return formatScalar(value);
    const values = Array.isArray(value) ? value : [value];
    const mapped = values
      .map((v) => {
        const raw = String(v ?? '').toLowerCase();
        const hit = options.find(
          (o) =>
            String(o.value ?? '').toLowerCase() === raw ||
            String(o.optionKey ?? '').toLowerCase() === raw
        );
        return hit?.label || formatScalar(v);
      })
      .filter(Boolean);
    return mapped.join(', ');
  };

  const out: DisplaySection[] = [];

  for (const [sectionKey, sectionValue] of Object.entries(bag)) {
    if (isPlainObject(sectionValue)) {
      const rows: DisplayField[] = [];
      for (const [key, value] of Object.entries(sectionValue)) {
        if (isPlainObject(value)) continue;
        rows.push({ label: labelFor(key), value: optionLabel(key, value) || EMPTY });
      }
      if (rows.some((r) => r.value !== EMPTY)) {
        out.push({ title: humanize(sectionKey), fields: rows });
      }
      continue;
    }
    if (Array.isArray(sectionValue) && sectionValue.some((v) => isPlainObject(v))) {
      // Record arrays (passports) have their own tab — skip them here.
      continue;
    }
    const formatted = optionLabel(sectionKey, sectionValue);
    if (formatted) {
      out.push({
        title: humanize(sectionKey),
        fields: [{ label: labelFor(sectionKey), value: formatted }],
      });
    }
  }

  return out;
}

/**
 * Read-only extension data rendered inside the client Overview tab.
 *
 * The enquiry itself lives on the source lead and is read through
 * `Company.leadId` — nothing is copied onto the client, so editing the lead
 * updates this immediately. Formatting is produced by the extension's own
 * `toDisplaySections`, so the CRM stays free of travel-specific knowledge.
 */
export const ClientExtensionOverviewSection: React.FC<ClientExtensionOverviewSectionProps> = ({
  section,
  extension,
  leadId,
  loading = false,
}) => {
  const [sections, setSections] = useState<DisplaySection[] | null>(null);
  const [resolving, setResolving] = useState(true);

  const bag = useMemo(() => {
    const root = isPlainObject(extension) ? extension : {};
    const slice = root[section.extensionId];
    return isPlainObject(slice) ? slice : null;
  }, [extension, section.extensionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setResolving(true);
      if (!bag) {
        if (!cancelled) {
          setSections([]);
          setResolving(false);
        }
        return;
      }

      const logic = await loadFieldLogic(section.logicUrl);

      // Preferred path: the extension formats its own data.
      if (logic?.toDisplaySections) {
        try {
          const result = await logic.toDisplaySections(
            { [section.extensionId]: bag },
            { extensionId: section.extensionId }
          );
          if (!cancelled && Array.isArray(result)) {
            setSections(
              result
                .map((s) => ({
                  title: String(s?.title || ''),
                  fields: (Array.isArray(s?.fields) ? s.fields : []).map((f) => ({
                    label: String(f?.label || ''),
                    value: formatScalar(f?.value) || EMPTY,
                    mono: !!f?.mono,
                  })),
                }))
                .filter((s) => s.fields.length)
            );
            setResolving(false);
          }
          return;
        } catch {
          /* fall through to the schema-driven fallback */
        }
      }

      const fields = await resolveExtensionFields([], section.schemaUrl, logic);
      if (!cancelled) {
        setSections(fallbackSections(bag, fields));
        setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bag, section.extensionId, section.logicUrl, section.schemaUrl]);

  // Nothing contributed for this client — render nothing rather than an empty card.
  if (!loading && !resolving && (!sections || !sections.length)) return null;

  return (
    <div
      className="rounded-xl border border-zinc-300 bg-white p-5"
      data-tour={`clients-overview-${section.id}`}
      data-extension-id={section.extensionId}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-sm font-bold text-zinc-950">{section.label}</h3>
        {leadId ? (
          <Link
            to={`/leads/${leadId}`}
            className="text-[11px] font-semibold text-zinc-600 no-underline hover:text-zinc-900 hover:underline"
          >
            Edit on source lead
          </Link>
        ) : null}
      </div>

      {section.hintMessage ? (
        <p className="m-0 mb-4 text-[11px] text-zinc-500">{section.hintMessage}</p>
      ) : null}

      {loading || resolving ? (
        <p className="m-0 text-xs text-zinc-500">Loading {section.label.toLowerCase()}…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {(sections || []).map((group) => (
            <div key={group.title}>
              {group.title ? (
                <h4 className="m-0 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  {group.title}
                </h4>
              ) : null}
              <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <div
                    key={`${group.title}-${field.label}`}
                    className="flex items-baseline justify-between gap-3 border-b border-zinc-100 pb-2"
                  >
                    <dt className="shrink-0 text-xs text-zinc-500">{field.label}</dt>
                    <dd
                      className={`m-0 min-w-0 break-words text-right text-xs font-semibold ${
                        field.value === EMPTY ? 'text-zinc-400' : 'text-zinc-900'
                      } ${field.mono ? 'font-mono' : ''}`}
                    >
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
