import { useMemo } from 'react';

type Props = {
  /** Lead.extension bag: { [extensionId]: sectionMap | fields } */
  extension?: unknown;
  /** Optional display names keyed by extensionId (from enabled extensions). */
  extensionLabels?: Record<string, string>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Map);
}

/** Convert Map / JSON-string / plain object into a plain record. */
export function normalizeExtensionBag(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    value.forEach((v, k) => {
      out[String(k)] = v;
    });
    return out;
  }
  if (!isPlainObject(value)) return null;
  // Clone so nested Maps / stringified sections are normalized one level deep.
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child instanceof Map) {
      const nested: Record<string, unknown> = {};
      child.forEach((v, k) => {
        nested[String(k)] = v;
      });
      out[key] = nested;
    } else if (typeof child === 'string') {
      try {
        const parsed = JSON.parse(child);
        out[key] = isPlainObject(parsed) || Array.isArray(parsed) ? parsed : child;
      } catch {
        out[key] = child;
      }
    } else {
      out[key] = child;
    }
  }
  return out;
}

/** crm-travel → Travel ; Travel-General-Information → Travel General Information */
export function humanizeExtensionKey(key: string): string {
  return String(key || '')
    .replace(/^crm[-_]/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatExtensionValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'string') return value.trim() || '—';
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    if (value.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.map((item) => String(item)).join(', ');
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (isPlainObject(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

/** True when every non-null child looks like a named section object (not a leaf field). */
function looksLikeSectionMap(value: Record<string, unknown>): boolean {
  const entries = Object.entries(value).filter(([, v]) => v != null);
  if (!entries.length) return false;
  return entries.every(([, v]) => isPlainObject(v) || Array.isArray(v));
}

type FieldRow = { label: string; value: string };
type SectionBlock = { title: string; fields: FieldRow[] };
type ExtensionBlock = { extensionId: string; title: string; sections: SectionBlock[] };

function fieldsFromObject(obj: Record<string, unknown>): FieldRow[] {
  return Object.entries(obj).map(([key, value]) => ({
    label: humanizeExtensionKey(key),
    value: formatExtensionValue(value),
  }));
}

function unwrapExtensionBag(bag: Record<string, unknown>, extensionId: string): Record<string, unknown> {
  // Handle accidental double-wrap: { "crm-travel": { "crm-travel": { ...sections } } }
  const nested = bag[extensionId];
  if (isPlainObject(nested) && looksLikeSectionMap(nested)) {
    return nested;
  }
  return bag;
}

function parseExtensionBlocks(
  extension: unknown,
  extensionLabels?: Record<string, string>
): ExtensionBlock[] {
  const root = normalizeExtensionBag(extension);
  if (!root || !Object.keys(root).length) return [];

  const blocks: ExtensionBlock[] = [];

  for (const [extensionId, rawBag] of Object.entries(root)) {
    if (!isPlainObject(rawBag)) {
      blocks.push({
        extensionId,
        title: extensionLabels?.[extensionId] || humanizeExtensionKey(extensionId),
        sections: [
          {
            title: 'Details',
            fields: [{ label: humanizeExtensionKey(extensionId), value: formatExtensionValue(rawBag) }],
          },
        ],
      });
      continue;
    }

    const bag = unwrapExtensionBag(rawBag, extensionId);
    const title = extensionLabels?.[extensionId] || humanizeExtensionKey(extensionId);
    const sections: SectionBlock[] = [];

    if (looksLikeSectionMap(bag)) {
      for (const [sectionKey, sectionVal] of Object.entries(bag)) {
        if (isPlainObject(sectionVal)) {
          const fields = fieldsFromObject(sectionVal);
          if (fields.length) {
            sections.push({ title: humanizeExtensionKey(sectionKey), fields });
          }
        } else if (Array.isArray(sectionVal)) {
          sections.push({
            title: humanizeExtensionKey(sectionKey),
            fields: [{ label: 'Values', value: formatExtensionValue(sectionVal) }],
          });
        } else if (sectionVal != null && sectionVal !== '') {
          sections.push({
            title: humanizeExtensionKey(sectionKey),
            fields: [{ label: 'Value', value: formatExtensionValue(sectionVal) }],
          });
        }
      }
    } else {
      const fields = fieldsFromObject(bag);
      if (fields.length) {
        sections.push({ title: 'Details', fields });
      }
    }

    // Always surface the extension block when the key exists — even if all values empty.
    if (!sections.length) {
      sections.push({
        title: 'Details',
        fields: [{ label: 'Status', value: 'No fields saved yet' }],
      });
    }

    blocks.push({ extensionId, title, sections });
  }

  return blocks;
}

/**
 * Generic read-only renderer for Lead.extension JSON.
 * Works for any plugin-extension key (crm-travel, crm-foo, …) without Travel hardcode.
 */
export function LeadExtensionDataSections({ extension, extensionLabels }: Props) {
  const blocks = useMemo(
    () => parseExtensionBlocks(extension, extensionLabels),
    [extension, extensionLabels]
  );

  if (!blocks.length) return null;

  return (
    <div className="flex flex-col gap-4" data-tour="leads-extension-data">
      {blocks.map((block) => (
        <div
          key={block.extensionId}
          className="bg-white border border-zinc-300 rounded-lg p-6"
          data-testid={`lead-extension-${block.extensionId}`}
        >
          <h3 className="m-0 text-sm font-bold text-zinc-950">{block.title}</h3>
          <p className="mb-4 mt-1 text-xs text-zinc-500">
            Read-only data from this CRM lead
            {block.extensionId ? (
              <>
                {' '}
                (<code className="text-[11px]">{block.extensionId}</code>)
              </>
            ) : null}
            .
          </p>

          <div className="flex flex-col gap-5">
            {block.sections.map((section) => (
              <div key={`${block.extensionId}-${section.title}`}>
                <h4 className="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-zinc-700">
                  {section.title}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <div
                      key={`${section.title}-${field.label}`}
                      className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5"
                    >
                      <span className="block text-[11px] font-medium text-zinc-400">{field.label}</span>
                      <strong className="mt-0.5 block text-xs font-semibold text-zinc-900 break-words">
                        {field.value}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
