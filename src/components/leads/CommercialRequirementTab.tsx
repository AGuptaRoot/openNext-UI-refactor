import React, { useEffect, useMemo, useState } from 'react';
import { DynamicFormRenderer } from '../form-builder/DynamicFormRenderer';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import type { LeadItem } from '../../types/leads';
import type {
  DynamicFieldValues,
  LeadCustomFieldOptions,
  RequestType,
} from '../../types/request-types';
import {
  emptyCommercialRequirement,
  scoreLabel,
  type LeadCommercialRequirement,
} from '../../utils/qualificationMatchScore';
import { getDefaultCurrencySymbol } from '../../utils/currency';
import { isProductRequestType } from '../../utils/isProductRequestType';

function scoreTone(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  if (score >= 80) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (score >= 55) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (score >= 30) return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-red-50 text-red-800 border-red-200';
}

function legacyValuesFromLead(commercial?: LeadCommercialRequirement | null): DynamicFieldValues {
  if (!commercial) return {};
  if (commercial.values && Object.keys(commercial.values).length) {
    return { ...commercial.values };
  }
  if (commercial.kind === 'project' && commercial.project) {
    const p = commercial.project;
    return {
      software_type: p.softwareType || '',
      technologies: p.technologies || [],
      number_of_users: p.numberOfUsers || '',
      integrations: p.integrations || [],
      budget: p.budget,
      modules_features: Array.isArray(p.modulesFeatures)
        ? p.modulesFeatures.join(', ')
        : '',
    };
  }
  if (commercial.kind === 'product' && commercial.product) {
    const p = commercial.product;
    return {
      product_name: p.productName || '',
      category: p.category || '',
      specification: p.specification || '',
      certifications: p.certifications || [],
      target_price: p.targetPrice || '',
      quantity: p.quantity,
    };
  }
  return {};
}

function normalizeCustomOptions(
  raw?: LeadCommercialRequirement['customOptions'] | null
): LeadCustomFieldOptions {
  if (!raw || typeof raw !== 'object') return {};
  const out: LeadCustomFieldOptions = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const options: Array<{ value: string; label: string }> = [];
    for (const item of list as Array<string | { value?: string; label?: string }>) {
      if (typeof item === 'string') {
        const v = item.trim();
        if (v) options.push({ value: v, label: v });
        continue;
      }
      const value = String(item?.value || item?.label || '').trim();
      const label = String(item?.label || item?.value || '').trim() || value;
      if (value) options.push({ value, label });
    }
    if (options.length) out[key] = options;
  }
  return out;
}

export interface CommercialRequirementTabProps {
  leadId: string;
  lead: LeadItem;
  canWrite: boolean;
  showToast: (message: string, kind?: 'success' | 'error') => void;
  onSaved: (lead: LeadItem) => void;
}

export const CommercialRequirementTab: React.FC<CommercialRequirementTabProps> = ({
  leadId,
  lead,
  canWrite,
  showToast,
  onSaved,
}) => {
  const currencySym = getDefaultCurrencySymbol();
  const { hasAnyPermission } = useAuth();
  const canPromoteGlobal = hasAnyPermission('crm.settings.manage');

  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [selectedId, setSelectedId] = useState(
    () =>
      String(lead.requestTypeId || lead.commercialRequirement?.requestTypeId || '')
  );
  const [values, setValues] = useState<DynamicFieldValues>(() =>
    legacyValuesFromLead(lead.commercialRequirement)
  );
  const [customOptions, setCustomOptions] = useState<LeadCustomFieldOptions>(() =>
    normalizeCustomOptions(lead.commercialRequirement?.customOptions)
  );
  const [scorePreview, setScorePreview] = useState<{
    score: number | null;
    breakdown: NonNullable<LeadCommercialRequirement['scoreBreakdown']>;
    matched: NonNullable<LeadCommercialRequirement['matchedRequirements']>;
    unmatched: NonNullable<LeadCommercialRequirement['unmatchedRequirements']>;
    missing: NonNullable<LeadCommercialRequirement['missingRequirements']>;
  }>({
    score: lead.commercialRequirement?.score ?? null,
    breakdown: lead.commercialRequirement?.scoreBreakdown || [],
    matched: lead.commercialRequirement?.matchedRequirements || [],
    unmatched: lead.commercialRequirement?.unmatchedRequirements || [],
    missing: lead.commercialRequirement?.missingRequirements || [],
  });
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsSampleRequest, setNeedsSampleRequest] = useState(() =>
    Boolean(
      lead.commercialRequirement?.needsSampleRequest ||
        lead.qualification?.sampleRequired
    )
  );

  const readOnly = !canWrite || Boolean(lead.convertedClientId);

  useEffect(() => {
    let cancelled = false;
    setLoadingTypes(true);
    crmApi
      .listRequestTypes({ includeDisabled: true })
      .then((res) => {
        if (cancelled) return;
        const all = Array.isArray(res.data) ? res.data : [];
        setRequestTypes(all);

        const currentId = String(
          lead.requestTypeId || lead.commercialRequirement?.requestTypeId || ''
        );
        const byName = all.find(
          (rt) =>
            rt.name.toLowerCase() === String(lead.requestType || '').trim().toLowerCase()
        );
        const resolved = currentId || byName?._id || '';
        setSelectedId(resolved);
        setValues(legacyValuesFromLead(lead.commercialRequirement));
        setCustomOptions(normalizeCustomOptions(lead.commercialRequirement?.customOptions));
        setNeedsSampleRequest(
          Boolean(
            lead.commercialRequirement?.needsSampleRequest ||
              lead.qualification?.sampleRequired
          )
        );
        setScorePreview({
          score: lead.commercialRequirement?.score ?? null,
          breakdown: lead.commercialRequirement?.scoreBreakdown || [],
          matched: lead.commercialRequirement?.matchedRequirements || [],
          unmatched: lead.commercialRequirement?.unmatchedRequirements || [],
          missing: lead.commercialRequirement?.missingRequirements || [],
        });
      })
      .catch(() => {
        if (!cancelled) setRequestTypes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTypes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, lead.requestType, lead.requestTypeId, lead.commercialRequirement]);

  const selectedType = useMemo(() => {
    if (!selectedId) return null;
    return requestTypes.find((rt) => rt._id === selectedId) || null;
  }, [requestTypes, selectedId]);

  const showSampleCheckbox = useMemo(() => {
    if (
      isProductRequestType(selectedType, {
        key: selectedType?.key || lead.commercialRequirement?.requestTypeKey,
        name: selectedType?.name || lead.requestType,
        kind: lead.commercialRequirement?.kind,
      })
    ) {
      return true;
    }
    // Fallback: Details tab already has Product selected but commercial type
    // object is still loading / unmatched by id.
    const byId = requestTypes.find(
      (rt) =>
        rt._id === selectedId ||
        rt._id === lead.requestTypeId ||
        rt._id === lead.commercialRequirement?.requestTypeId
    );
    if (byId && isProductRequestType(byId)) return true;
    return isProductRequestType(null, {
      key: lead.commercialRequirement?.requestTypeKey,
      name: lead.requestType,
      kind: lead.commercialRequirement?.kind,
    });
  }, [
    selectedType,
    selectedId,
    requestTypes,
    lead.requestType,
    lead.requestTypeId,
    lead.commercialRequirement?.requestTypeId,
    lead.commercialRequirement?.requestTypeKey,
    lead.commercialRequirement?.kind,
  ]);

  const selectableTypes = useMemo(() => {
    return requestTypes.filter(
      (rt) => rt.isEnabled || rt._id === selectedId || rt._id === lead.requestTypeId
    );
  }, [requestTypes, selectedId, lead.requestTypeId]);

  const handleSelectType = (id: string) => {
    setSelectedId(id);
    const next = requestTypes.find((rt) => rt._id === id);
    if (!next) return;
    const nextValues: DynamicFieldValues = {};
    const nextCustom: LeadCustomFieldOptions = {};
    for (const field of next.fields || []) {
      if (values[field.key] !== undefined) nextValues[field.key] = values[field.key];
      else if (field.type === 'multiselect') nextValues[field.key] = [];
      else if (field.type === 'number') nextValues[field.key] = null;
      else nextValues[field.key] = '';
      if (customOptions[field.key]?.length) nextCustom[field.key] = customOptions[field.key];
    }
    setValues(nextValues);
    setCustomOptions(nextCustom);
    if (!isProductRequestType(next)) {
      setNeedsSampleRequest(false);
    }
  };

  const selectNewOption = (fieldKey: string, optionValue: string, fieldType: string) => {
    setValues((prev) => {
      if (fieldType === 'multiselect') {
        const current = Array.isArray(prev[fieldKey]) ? (prev[fieldKey] as string[]) : [];
        if (current.some((v) => v.toLowerCase() === optionValue.toLowerCase())) return prev;
        return { ...prev, [fieldKey]: [...current, optionValue] };
      }
      return { ...prev, [fieldKey]: optionValue };
    });
  };

  const handleAddLeadOption = async (payload: {
    fieldKey: string;
    label: string;
    value: string;
    addToGlobalCatalog: boolean;
  }) => {
    if (!selectedType || readOnly) return;
    const field = (selectedType.fields || []).find((f) => f.key === payload.fieldKey);
    if (!field) return;

    if (payload.addToGlobalCatalog) {
      const updated = await crmApi.addRequestTypeFieldOption(
        selectedType._id,
        payload.fieldKey,
        { label: payload.label, value: payload.value }
      );
      if (updated.data) {
        setRequestTypes((prev) =>
          prev.map((rt) => (rt._id === updated.data!._id ? updated.data! : rt))
        );
      }
      selectNewOption(payload.fieldKey, payload.value, field.type);
      showToast(`Added "${payload.label}" to global catalog and selected it`);
      return;
    }

    // Build next custom options + values synchronously, then persist immediately so the
    // option survives reload and appears on the converted Client commercial tab.
    const nextCustom: LeadCustomFieldOptions = { ...customOptions };
    const list = [...(nextCustom[payload.fieldKey] || [])];
    if (!list.some((o) => o.value.toLowerCase() === payload.value.toLowerCase())) {
      list.push({ label: payload.label, value: payload.value });
    }
    nextCustom[payload.fieldKey] = list;

    let nextValues: DynamicFieldValues = { ...values };
    if (field.type === 'multiselect') {
      const current = Array.isArray(nextValues[payload.fieldKey])
        ? (nextValues[payload.fieldKey] as string[])
        : [];
      if (!current.some((v) => v.toLowerCase() === payload.value.toLowerCase())) {
        nextValues = { ...nextValues, [payload.fieldKey]: [...current, payload.value] };
      }
    } else {
      nextValues = { ...nextValues, [payload.fieldKey]: payload.value };
    }

    setCustomOptions(nextCustom);
    setValues(nextValues);

    try {
      const res = await crmApi.updateLeadCommercialRequirement(leadId, {
        requestTypeId: selectedType._id,
        requestType: selectedType.name,
        values: nextValues,
        customOptions: nextCustom,
        kind: 'dynamic',
        needsSampleRequest: isProductRequestType(selectedType)
          ? needsSampleRequest
          : false,
      });
      const saved = res.data?.commercialRequirement || emptyCommercialRequirement();
      setCustomOptions(normalizeCustomOptions(saved.customOptions));
      setNeedsSampleRequest(Boolean(saved.needsSampleRequest));
      setScorePreview({
        score: saved.score ?? null,
        breakdown: saved.scoreBreakdown || [],
        matched: saved.matchedRequirements || [],
        unmatched: saved.unmatchedRequirements || [],
        missing: saved.missingRequirements || [],
      });
      if (res.data) onSaved(res.data);
      showToast(`Added "${payload.label}" for this lead and saved`);
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Option added in form but failed to save — click Save commercial requirement',
        'error'
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!selectedType) {
      showToast('Select a Request Type first', 'error');
      return;
    }
    for (const field of selectedType.fields || []) {
      const v = values[field.key];
      const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (field.required && empty) {
        showToast(`${field.label} is required`, 'error');
        return;
      }

      if (field.type === 'number' && v != null && v !== '') {
        const num = Number(v);
        const isBudget = field.key === 'budget' || field.label.trim().toLowerCase() === 'budget';
        const effMin = field.minAmount ?? field.matchNumberMin ?? (isBudget ? selectedType.minBudget : null);
        const effMax = field.maxAmount ?? field.matchNumberMax ?? (isBudget ? selectedType.maxBudget : null);

        if (effMin != null && num < effMin) {
          showToast(
            `${field.label} must be at least ${currencySym}${effMin.toLocaleString()} for ${selectedType.name} (allowed range: ${currencySym}${effMin.toLocaleString()} – ${currencySym}${effMax != null ? effMax.toLocaleString() : '∞'})`,
            'error'
          );
          return;
        }
        if (effMax != null && num > effMax) {
          showToast(
            `${field.label} cannot exceed ${currencySym}${effMax.toLocaleString()} for ${selectedType.name} (allowed range: ${currencySym}${effMin != null ? effMin.toLocaleString() : '0'} – ${currencySym}${effMax.toLocaleString()})`,
            'error'
          );
          return;
        }
      }
    }
    setSaving(true);
    try {
      const productType = isProductRequestType(selectedType);
      const res = await crmApi.updateLeadCommercialRequirement(leadId, {
        requestTypeId: selectedType._id,
        requestType: selectedType.name,
        values,
        customOptions,
        kind: 'dynamic',
        needsSampleRequest: productType ? needsSampleRequest : false,
      });
      const saved = res.data.commercialRequirement || emptyCommercialRequirement();
      setCustomOptions(normalizeCustomOptions(saved.customOptions));
      setNeedsSampleRequest(Boolean(saved.needsSampleRequest));
      setScorePreview({
        score: saved.score ?? null,
        breakdown: saved.scoreBreakdown || [],
        matched: saved.matchedRequirements || [],
        unmatched: saved.unmatchedRequirements || [],
        missing: saved.missingRequirements || [],
      });
      onSaved(res.data);
      showToast(
        saved.score == null
          ? 'Commercial requirement saved'
          : `Commercial requirement saved — match score ${saved.score}%`
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save commercial requirement',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-5"
      data-tour="lead-commercial-requirement"
    >
      <div className="rounded-xl border border-zinc-300 bg-white p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="m-0 text-sm font-bold text-zinc-950">Commercial Requirement</h3>
            <p className="mb-0 mt-1 text-xs text-zinc-500">
              Select a Request Type to load its dynamic form. Use + Add New on select fields for
              lead-specific options. Score uses the Qualification Match catalog.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${scoreTone(
              scorePreview.score
            )}`}
          >
            {scorePreview.score == null ? 'Not scored' : `${scorePreview.score}%`}
            <span className="font-medium opacity-80">· {scoreLabel(scorePreview.score)}</span>
          </div>
        </div>

        <label className="mb-4 block max-w-md">
          <span className="mb-1.5 block text-xs font-semibold text-zinc-700">Request Type</span>
          <select
            className="h-9 w-full box-border rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-50"
            disabled={readOnly || loadingTypes}
            value={selectedId}
            onChange={(e) => handleSelectType(e.target.value)}
          >
            <option value="">{loadingTypes ? 'Loading…' : 'Select request type…'}</option>
            {selectableTypes.map((rt) => (
              <option key={rt._id} value={rt._id}>
                {rt.name}
                {!rt.isEnabled ? ' (disabled)' : ''}
              </option>
            ))}
          </select>
        </label>

        {/* Product only: checkbox appears immediately when Request Type is Product */}
        {showSampleCheckbox ? (
          <label
            data-tour="lead-needs-sample-request"
            className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              checked={needsSampleRequest}
              disabled={readOnly}
              onChange={(e) => setNeedsSampleRequest(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-950">
                Lead needs sample request
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-600">
                Visible only for Product request types. When checked, a &quot;Sample needs&quot; tag
                appears on the Leads list. Remember to save commercial requirement.
              </span>
            </span>
          </label>
        ) : null}

        {selectedType ? (
          <>
            <div className="mb-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
              Form for <strong className="text-zinc-900">{selectedType.name}</strong>
              {!selectedType.isEnabled
                ? ' — this type is disabled for new leads but still available on this record.'
                : null}
              {' '}
              Lead-only options stay on this lead unless added to the global catalog.
            </div>
            {(selectedType.minBudget != null || selectedType.maxBudget != null) && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Commercial Budget Limits:
                </span>
                <span className="font-semibold text-amber-950">
                  {selectedType.minBudget != null ? `${currencySym}${selectedType.minBudget.toLocaleString()}` : `${currencySym}0`}
                  {' – '}
                  {selectedType.maxBudget != null ? `${currencySym}${selectedType.maxBudget.toLocaleString()}` : 'No maximum limit'}
                </span>
              </div>
            )}
            <DynamicFormRenderer
              fields={selectedType.fields || []}
              values={values}
              onChange={setValues}
              disabled={readOnly}
              leadCustomOptions={customOptions}
              allowLeadCustomOptions={!readOnly}
              canPromoteGlobal={canPromoteGlobal}
              onAddLeadOption={handleAddLeadOption}
              minBudget={selectedType.minBudget}
              maxBudget={selectedType.maxBudget}
            />
          </>
        ) : (
          <p className="m-0 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">
            Choose a Request Type to render its commercial requirement form.
          </p>
        )}
      </div>

      {(scorePreview.breakdown.length > 0 ||
        scorePreview.missing.length > 0 ||
        scorePreview.matched.length > 0 ||
        scorePreview.unmatched.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-emerald-800">
              Matched
            </h4>
            <ul className="mt-2 list-none space-y-1 p-0">
              {(scorePreview.matched.length
                ? scorePreview.matched
                : scorePreview.breakdown.filter((b) => b.score >= 100)
              ).map((item) => (
                <li key={item.key} className="text-xs text-emerald-900">
                  <strong>{item.label}</strong>
                  <span className="block text-[11px] opacity-80">{item.detail}</span>
                </li>
              ))}
              {!scorePreview.matched.length &&
              !scorePreview.breakdown.some((b) => b.score >= 100) ? (
                <li className="text-xs text-emerald-800/70">None yet</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-amber-800">
              Unmatched / Not Configured
            </h4>
            <ul className="mt-2 list-none space-y-1 p-0">
              {(scorePreview.unmatched.length
                ? scorePreview.unmatched
                : scorePreview.breakdown.filter((b) => b.score < 100)
              ).map((item) => (
                <li key={item.key} className="text-xs text-amber-950">
                  <strong>{item.label}</strong>
                  <span className="block text-[11px] opacity-80">{item.detail}</span>
                </li>
              ))}
              {!scorePreview.unmatched.length &&
              !scorePreview.breakdown.some((b) => b.score < 100) ? (
                <li className="text-xs text-amber-800/70">None</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-zinc-700">
              Missing
            </h4>
            <ul className="mt-2 list-none space-y-1 p-0">
              {scorePreview.missing.map((item) => (
                <li key={item.key} className="text-xs text-zinc-800">
                  <strong>{item.label}</strong>
                  <span className="block text-[11px] text-zinc-500">{item.detail}</span>
                </li>
              ))}
              {!scorePreview.missing.length ? (
                <li className="text-xs text-zinc-500">No required fields missing</li>
              ) : null}
            </ul>
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !selectedType}
            className="inline-flex h-10 items-center rounded-lg border-0 bg-zinc-950 px-5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save commercial requirement'}
          </button>
        </div>
      )}
    </form>
  );
};
