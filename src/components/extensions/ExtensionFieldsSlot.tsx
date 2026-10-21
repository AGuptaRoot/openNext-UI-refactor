import { useCallback, useEffect, useMemo, useState } from 'react';

export type ExtensionFieldOptionsSource = {
  /** Absolute or same-origin API URL that returns { data: { [key]: OptionRow[] } } or OptionRow[]. */
  url: string;
  /** Property on the response payload that holds this field's options (e.g. "from"). */
  key: string;
};

export type ExtensionFieldDef = {
  id: string;
  label: string;
  fieldType: string;
  required?: boolean;
  readOnly?: boolean;
  /** Hide from UI but keep in values / extension payload (auto-filled fields). */
  hidden?: boolean;
  /** Fields sharing the same layoutRow render on one horizontal line. */
  layoutRow?: string | null;
  order?: number;
  options?: Array<{ value?: string; label?: string; optionKey?: string }>;
  /** Load select options from an API (e.g. Travel Settings → Locations). */
  optionsSource?: ExtensionFieldOptionsSource | null;
  /** Optional default when seeding empty values (e.g. Settings default currency). */
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  section?: string | null;
  whenRequestTypeKey?: string | null;
  whenRequestTypeName?: string | null;
};

export type ExtensionFieldGroup = {
  extensionId: string;
  sectionLabel: string;
  whenRequestTypeKey?: string | null;
  whenRequestTypeName?: string | null;
  logicUrl?: string;
  schemaUrl?: string;
  order?: number;
  fields: ExtensionFieldDef[];
};

type FieldLogicModule = {
  onFieldChange?: (values: Record<string, unknown>, changedKey: string | null) => Record<string, unknown>;
  validate?: (values: Record<string, unknown>) => Array<{ id?: string; message: string }>;
  toExtensionBag?: (
    values: Record<string, unknown>,
    meta?: Record<string, string>
  ) => Record<string, unknown>;
  /** Flatten Lead.extension bag → Create Lead field values (for Details tab). */
  fromExtensionBag?: (
    extensionOrBag: Record<string, unknown>,
    extensionId?: string
  ) => Record<string, unknown>;
  /** Optional: enrich field defs (e.g. load select options from extension settings/API). */
  enrichFields?: (fields: ExtensionFieldDef[]) => Promise<ExtensionFieldDef[]> | ExtensionFieldDef[];
};

const logicCache = new Map<string, Promise<FieldLogicModule | null>>();
const optionsSourceCache = new Map<string, Promise<unknown>>();

function rowsToSelectOptions(
  rows: unknown
): Array<{ value: string; label: string; optionKey: string }> {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((o) => o && typeof o === 'object' && (o as { enabled?: boolean }).enabled !== false)
    .slice()
    .sort(
      (a, b) =>
        Number((a as { displayOrder?: number }).displayOrder || 0) -
        Number((b as { displayOrder?: number }).displayOrder || 0)
    )
    .map((raw) => {
      const o = raw as {
        label?: string;
        optionKey?: string;
        value?: string;
        serviceId?: string;
        serviceKey?: string;
        name?: string;
      };
      // Travel services use stable serviceId (not display name)
      const serviceId = String(o.serviceId || '').trim();
      const label = String(o.name || o.label || o.serviceKey || o.optionKey || '').trim();
      const optionKey = String(o.serviceKey || o.optionKey || label)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const value = serviceId || String(o.value || '').trim() || label || optionKey;
      return { value, label: label || value, optionKey: optionKey || value };
    })
    .filter((o) => o.value);
}

async function fetchOptionsSourcePayload(url: string): Promise<unknown> {
  if (!optionsSourceCache.has(url)) {
    optionsSourceCache.set(
      url,
      (async () => {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`optionsSource HTTP ${res.status}`);
        const json = await res.json();
        return json && typeof json === 'object' && 'data' in json ? (json as { data: unknown }).data : json;
      })()
    );
  }
  return optionsSourceCache.get(url);
}

/** Fill select/checkbox options from field.optionsSource URLs (Locations, Services, etc.). */
async function applyOptionsSources(fields: ExtensionFieldDef[]): Promise<ExtensionFieldDef[]> {
  const out: ExtensionFieldDef[] = [];
  for (const field of fields || []) {
    const src = field.optionsSource;
    if (!src?.url || !src.key) {
      out.push(field);
      continue;
    }
    try {
      const payload = await fetchOptionsSourcePayload(src.url);
      let rows: unknown = null;
      if (src.key === '_array') {
        rows = Array.isArray(payload)
          ? payload
          : payload &&
              typeof payload === 'object' &&
              Array.isArray((payload as { services?: unknown }).services)
            ? (payload as { services: unknown[] }).services
            : null;
      } else if (payload && typeof payload === 'object') {
        rows = (payload as Record<string, unknown>)[src.key];
      }
      const options = rowsToSelectOptions(rows);
      const keepType =
        field.fieldType === 'checkbox' || field.fieldType === 'multiselect'
          ? field.fieldType
          : 'select';
      out.push({
        ...field,
        fieldType: keepType,
        options: options.length ? options : field.options || [],
      });
    } catch {
      out.push(field);
    }
  }
  return out;
}

async function loadFieldLogic(url?: string): Promise<FieldLogicModule | null> {
  if (!url) return null;
  if (!logicCache.has(url)) {
    logicCache.set(
      url,
      (async () => {
        try {
          const mod = await import(/* @vite-ignore */ url);
          return (mod && typeof mod === 'object' ? mod : null) as FieldLogicModule | null;
        } catch {
          try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return null;
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/javascript' });
            const objectUrl = URL.createObjectURL(blob);
            try {
              const mod = await import(/* @vite-ignore */ objectUrl);
              return (mod && typeof mod === 'object' ? mod : null) as FieldLogicModule | null;
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          } catch {
            return null;
          }
        }
      })()
    );
  }
  return logicCache.get(url) || null;
}

function matchesRequestType(
  group: Pick<ExtensionFieldGroup, 'whenRequestTypeKey' | 'whenRequestTypeName'>,
  requestType?: { key?: string | null; name?: string | null } | null
): boolean {
  const key = String(requestType?.key || '')
    .trim()
    .toLowerCase();
  const name = String(requestType?.name || '')
    .trim()
    .toLowerCase();
  if (!group.whenRequestTypeKey && !group.whenRequestTypeName) return true;
  if (group.whenRequestTypeKey && group.whenRequestTypeKey === key) return true;
  if (group.whenRequestTypeName && group.whenRequestTypeName === name) return true;
  return false;
}

type Props = {
  groups: ExtensionFieldGroup[];
  requestType?: { key?: string | null; name?: string | null } | null;
  meta?: { preparedBy?: string; primaryTraveller?: string; defaultCurrency?: string };
  valuesByExtension: Record<string, Record<string, unknown>>;
  onChange: (extensionId: string, values: Record<string, unknown>) => void;
  sectionClassName?: string;
  titleClassName?: string;
  inputClassName?: string;
};

function groupFieldsForLayout(fields: ExtensionFieldDef[]): Array<{
  key: string;
  layoutRow: string | null;
  fields: ExtensionFieldDef[];
}> {
  const visible = (fields || []).filter((f) => f?.id && !f.hidden);
  const groups: Array<{ key: string; layoutRow: string | null; fields: ExtensionFieldDef[] }> = [];
  for (const field of visible) {
    const row = field.layoutRow ? String(field.layoutRow) : null;
    const last = groups[groups.length - 1];
    if (row && last && last.layoutRow === row) {
      last.fields.push(field);
      continue;
    }
    groups.push({
      key: row ? `row:${row}:${field.id}` : `field:${field.id}`,
      layoutRow: row,
      fields: [field],
    });
  }
  return groups;
}

export function ExtensionFieldsSlot({
  groups,
  requestType,
  meta,
  valuesByExtension,
  onChange,
  sectionClassName = '',
  titleClassName = '',
  inputClassName = '',
}: Props) {
  const [logicByExt, setLogicByExt] = useState<Record<string, FieldLogicModule | null>>({});
  const [schemaFieldsByExt, setSchemaFieldsByExt] = useState<
    Record<string, ExtensionFieldDef[]>
  >({});

  const visibleGroups = useMemo(
    () =>
      (groups || [])
        .filter((g) => matchesRequestType(g, requestType))
        .sort((a, b) => (a.order || 100) - (b.order || 100)),
    [groups, requestType]
  );

  useEffect(() => {
    let cancelled = false;
    // Fresh locations each time Create Lead fields mount (after Settings edits)
    optionsSourceCache.clear();
    (async () => {
      const nextLogic: Record<string, FieldLogicModule | null> = {};
      const nextSchema: Record<string, ExtensionFieldDef[]> = {};
      for (const g of visibleGroups) {
        const logic = await loadFieldLogic(g.logicUrl);
        nextLogic[g.extensionId] = logic;
        let fields: ExtensionFieldDef[] = Array.isArray(g.fields) ? [...g.fields] : [];
        if (g.schemaUrl) {
          try {
            const res = await fetch(g.schemaUrl, { credentials: 'include' });
            if (res.ok) {
              const json = await res.json();
              if (Array.isArray(json?.fields)) {
                const byId = new Map(fields.map((f) => [f.id, f]));
                for (const sf of json.fields as ExtensionFieldDef[]) {
                  const base = byId.get(sf.id);
                  byId.set(sf.id, base ? { ...base, ...sf, id: sf.id } : sf);
                }
                fields = [...byId.values()];
              }
            }
          } catch {
            /* optional schema enrichment */
          }
        }
        if (logic?.enrichFields) {
          try {
            fields = (await logic.enrichFields(fields)) || fields;
          } catch {
            /* keep static fields if options API fails */
          }
        }
        // Always resolve optionsSource (does not depend on calc.js dynamic import)
        fields = await applyOptionsSources(fields);
        nextSchema[g.extensionId] = fields;
      }
      if (!cancelled) {
        setLogicByExt(nextLogic);
        setSchemaFieldsByExt(nextSchema);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleGroups]);

  useEffect(() => {
    for (const g of visibleGroups) {
      const current = { ...(valuesByExtension[g.extensionId] || {}) };
      const schemaFields = schemaFieldsByExt[g.extensionId] || g.fields || [];
      let changed = false;
      const seed: Record<string, unknown> = { ...current };

      // Auto-fill: Prepared By = lead creator; Primary Traveller = contact person
      if (meta?.preparedBy && seed['prepared-by'] !== meta.preparedBy) {
        seed['prepared-by'] = meta.preparedBy;
        changed = true;
      }
      if (
        meta?.primaryTraveller != null &&
        seed['primary-traveller'] !== meta.primaryTraveller
      ) {
        seed['primary-traveller'] = meta.primaryTraveller;
        changed = true;
      }
      // Currency defaults from Settings → General → Default Currency
      if (!seed['currency-code']) {
        const fromSchema = schemaFields.find((f) => f.id === 'currency-code')?.defaultValue;
        const code = String(meta?.defaultCurrency || fromSchema || '').trim().toUpperCase();
        if (code) {
          seed['currency-code'] = code;
          changed = true;
        }
      }

      if (!changed && Object.keys(current).length) continue;

      const logic = logicByExt[g.extensionId];
      const next = logic?.onFieldChange ? logic.onFieldChange(seed, null) : seed;
      onChange(g.extensionId, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleGroups,
    logicByExt,
    schemaFieldsByExt,
    meta?.preparedBy,
    meta?.primaryTraveller,
    meta?.defaultCurrency,
  ]);

  const setField = useCallback(
    (extensionId: string, fieldId: string, raw: unknown) => {
      const prev = { ...(valuesByExtension[extensionId] || {}) };
      prev[fieldId] = raw;
      const logic = logicByExt[extensionId];
      const next = logic?.onFieldChange ? logic.onFieldChange(prev, fieldId) : prev;
      onChange(extensionId, next);
    },
    [logicByExt, onChange, valuesByExtension]
  );

  if (!visibleGroups.length) return null;

  return (
    <>
      {visibleGroups.map((group) => {
        const values = valuesByExtension[group.extensionId] || {};
        const schemaFields = schemaFieldsByExt[group.extensionId];
        const fields = (
          Array.isArray(schemaFields) && schemaFields.length
            ? schemaFields
            : [...(group.fields || [])]
        ).sort((a, b) => (a.order || 100) - (b.order || 100));
        return (
          <section
            key={group.extensionId}
            data-tour="leads-extension-fields-slot"
            data-extension-id={group.extensionId}
            className={sectionClassName}
          >
            <h3 className={titleClassName}>{group.sectionLabel || 'Extension fields'}</h3>
            <p className="mt-0 mb-3 text-xs text-zinc-500">
              Fields from extension <code className="text-[11px]">{group.extensionId}</code> — logic
              runs in the extension package (not hard-coded in CRM).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupFieldsForLayout(fields).map((block) => {
                const renderField = (field: ExtensionFieldDef) => {
                  const value = values[field.id];
                  const opts = field.options || [];
                  const common = {
                    id: `ext_${group.extensionId}_${field.id}`,
                    className: inputClassName,
                    disabled: !!field.readOnly,
                    required: !!field.required,
                    placeholder: field.placeholder || undefined,
                    readOnly: !!field.readOnly,
                  };
                  const isCheckbox =
                    field.fieldType === 'checkbox' || field.fieldType === 'multiselect';
                  const selectedIds = Array.isArray(value)
                    ? value.map(String)
                    : value != null && value !== ''
                      ? [String(value)]
                      : [];

                  return (
                    <div
                      key={field.id}
                      className={`flex flex-col gap-1 text-xs text-zinc-700 min-w-0 ${
                        isCheckbox ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <span className="font-semibold text-zinc-900">
                        {field.label}
                        {field.required ? <span className="text-red-600"> *</span> : null}
                      </span>
                      {isCheckbox ? (
                        <div
                          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
                          role="group"
                          aria-label={field.label}
                        >
                          {opts.length ? (
                            opts.map((o) => {
                              const v = String(o.value || o.optionKey || '');
                              const checked = selectedIds.includes(v);
                              const inputId = `${common.id}__${v}`;
                              return (
                                <label
                                  key={v}
                                  htmlFor={inputId}
                                  className="flex items-center gap-2 text-xs text-zinc-800 cursor-pointer select-none"
                                >
                                  <input
                                    id={inputId}
                                    type="checkbox"
                                    className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                                    disabled={!!field.readOnly}
                                    checked={checked}
                                    onChange={(e) => {
                                      if (field.readOnly) return;
                                      const set = new Set(selectedIds);
                                      if (e.target.checked) set.add(v);
                                      else set.delete(v);
                                      setField(group.extensionId, field.id, [...set]);
                                    }}
                                  />
                                  <span>{o.label || v}</span>
                                </label>
                              );
                            })
                          ) : (
                            <span className="text-[11px] text-zinc-500">
                              No services available. Enable services in Settings → Travel.
                            </span>
                          )}
                        </div>
                      ) : field.fieldType === 'textarea' ? (
                        <textarea
                          {...common}
                          rows={3}
                          value={value != null ? String(value) : ''}
                          onChange={(e) => setField(group.extensionId, field.id, e.target.value)}
                        />
                      ) : field.fieldType === 'select' ? (
                        <select
                          {...common}
                          value={value != null ? String(value) : ''}
                          onChange={(e) => setField(group.extensionId, field.id, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {opts.map((o) => {
                            const v = String(o.value || o.optionKey || '');
                            return (
                              <option key={v} value={v}>
                                {o.label || v}
                              </option>
                            );
                          })}
                        </select>
                      ) : field.fieldType === 'number' ? (
                        <input
                          {...common}
                          type="number"
                          min={0}
                          value={value != null && value !== '' ? String(value) : ''}
                          onChange={(e) =>
                            setField(
                              group.extensionId,
                              field.id,
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                        />
                      ) : field.fieldType === 'date' ? (
                        <input
                          {...common}
                          type="date"
                          value={value != null ? String(value) : ''}
                          onChange={(e) => setField(group.extensionId, field.id, e.target.value)}
                        />
                      ) : (
                        <input
                          {...common}
                          type="text"
                          value={value != null ? String(value) : ''}
                          onChange={(e) => {
                            if (field.readOnly) return;
                            setField(group.extensionId, field.id, e.target.value);
                          }}
                        />
                      )}
                      {field.helpText ? (
                        <span className="text-[11px] text-zinc-500">{field.helpText}</span>
                      ) : null}
                    </div>
                  );
                };

                if (block.layoutRow && block.fields.length > 1) {
                  const rowClass =
                    block.layoutRow === 'travellers'
                      ? 'sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3'
                      : 'sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3';
                  return (
                    <div key={block.key} className={rowClass}>
                      {block.fields.map(renderField)}
                    </div>
                  );
                }
                const only = block.fields[0];
                if (
                  only &&
                  (only.fieldType === 'checkbox' || only.fieldType === 'multiselect')
                ) {
                  return (
                    <div key={block.key} className="sm:col-span-2">
                      {block.fields.map(renderField)}
                    </div>
                  );
                }
                return (
                  <div key={block.key} className="contents">
                    {block.fields.map(renderField)}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

/**
 * Hydrate Create Lead–style field values from Lead.extension (Details tab).
 * Uses each group's fromExtensionBag when available.
 */
export async function hydrateExtensionFieldValuesFromLead(
  groups: ExtensionFieldGroup[],
  extension: Record<string, unknown> | null | undefined,
  requestType?: { key?: string | null; name?: string | null } | null
): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {};
  const bag = extension && typeof extension === 'object' ? extension : {};
  for (const group of groups || []) {
    if (!matchesRequestType(group, requestType)) continue;
    const logic = await loadFieldLogic(group.logicUrl);
    if (logic?.fromExtensionBag) {
      const flat = logic.fromExtensionBag(bag, group.extensionId);
      out[group.extensionId] =
        flat && typeof flat === 'object' ? { ...flat } : {};
      continue;
    }
    const slice = bag[group.extensionId];
    out[group.extensionId] =
      slice && typeof slice === 'object' && !Array.isArray(slice)
        ? { ...(slice as Record<string, unknown>) }
        : {};
  }
  return out;
}

/** Build Lead.extension payload from flat field values + optional extension logic modules. */
export async function buildExtensionPayloadFromFields(
  groups: ExtensionFieldGroup[],
  valuesByExtension: Record<string, Record<string, unknown>>,
  requestType?: { key?: string | null; name?: string | null } | null,
  meta?: { preparedBy?: string; primaryTraveller?: string; defaultCurrency?: string }
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const group of groups || []) {
    if (!matchesRequestType(group, requestType)) continue;
    const values = valuesByExtension[group.extensionId] || {};
    const logic = await loadFieldLogic(group.logicUrl);
    if (logic?.toExtensionBag) {
      const bag = logic.toExtensionBag(values, {
        preparedBy: meta?.preparedBy || '',
        primaryTraveller: meta?.primaryTraveller || '',
        defaultCurrency: meta?.defaultCurrency || '',
      });
      if (bag && typeof bag === 'object') {
        for (const [k, v] of Object.entries(bag)) out[k] = v;
      }
    } else {
      out[group.extensionId] = { ...values };
    }
  }
  return out;
}

export async function validateExtensionFields(
  groups: ExtensionFieldGroup[],
  valuesByExtension: Record<string, Record<string, unknown>>,
  requestType?: { key?: string | null; name?: string | null } | null
): Promise<string | null> {
  for (const group of groups || []) {
    if (!matchesRequestType(group, requestType)) continue;
    const values = valuesByExtension[group.extensionId] || {};
    for (const field of group.fields || []) {
      if (!field.required) continue;
      const v = values[field.id];
      if (v == null || String(v).trim() === '') {
        return `${field.label || field.id} is required`;
      }
    }
    const logic = await loadFieldLogic(group.logicUrl);
    if (logic?.validate) {
      const errors = logic.validate(values) || [];
      if (errors.length) return errors[0].message || 'Extension fields are invalid';
    }
  }
  return null;
}
