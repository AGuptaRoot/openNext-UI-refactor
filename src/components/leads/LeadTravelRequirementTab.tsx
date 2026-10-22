import React, { useEffect, useMemo, useState } from 'react';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SaveIcon from '@mui/icons-material/Save';
import { crmApi } from '../../services/api';
import type { RequirementFieldItem, ServiceDef } from '../../pages/add-ons/AddOnsPage';
import { DEFAULT_SERVICES, serviceNameToDef, getServiceIcon } from '../../pages/add-ons/AddOnsPage';

export interface LeadTravelRequirementTabProps {
  leadId: string;
  lead?: any;
  onUpdated?: () => void;
}

export const LeadTravelRequirementTab: React.FC<LeadTravelRequirementTabProps> = ({
  leadId,
  lead,
  onUpdated,
}) => {
  const [services, setServices] = useState<ServiceDef[]>(DEFAULT_SERVICES);
  const [fields, setFields] = useState<RequirementFieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Load configured travel services from settings
  useEffect(() => {
    let cancelled = false;
    crmApi.getTravelServices().then((res) => {
      if (cancelled) return;
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setServices(res.data.map(serviceNameToDef));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Selected services for this lead
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => {
    const ext = lead?.extension && typeof lead.extension === 'object' ? lead.extension : {};
    const travel = ext['crm-travel'] || {};
    if (Array.isArray(travel.selectedServiceIds) && travel.selectedServiceIds.length) {
      return travel.selectedServiceIds;
    }
    return ['hotel'];
  });

  // Stored values per service: { [serviceId]: { [fieldKey]: any } }
  const [serviceValues, setServiceValues] = useState<Record<string, Record<string, any>>>(() => {
    const ext = lead?.extension && typeof lead.extension === 'object' ? lead.extension : {};
    const travel = ext['crm-travel'] || {};
    const initial: Record<string, Record<string, any>> = {};
    if (travel.requirements && typeof travel.requirements === 'object') {
      return travel.requirements;
    }
    return initial;
  });

  // Load configured fields and lead requirements
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const [fieldsRes, reqRes] = await Promise.all([
          crmApi.getTravelRequirementFields({ all: false }),
          crmApi.getLeadTravelRequirements(leadId),
        ]);

        if (cancelled) return;

        if (fieldsRes && fieldsRes.data) {
          setFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
        }

        if (reqRes && reqRes.data) {
          const leadData = reqRes.data.lead;
          if (leadData && Array.isArray(leadData.selectedServiceIds) && leadData.selectedServiceIds.length) {
            setSelectedServiceIds(leadData.selectedServiceIds);
          }
          if (Array.isArray(reqRes.data.sections)) {
            const loadedVals: Record<string, Record<string, any>> = {};
            for (const sec of reqRes.data.sections) {
              if (sec.service?.serviceId && sec.requirement?.values) {
                loadedVals[sec.service.serviceId] = sec.requirement.values;
              }
            }
            if (Object.keys(loadedVals).length) {
              setServiceValues((prev) => ({ ...loadedVals, ...prev }));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load travel requirements:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (leadId) void loadData();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Toggle service
  const toggleService = (svcId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(svcId) ? prev.filter((id) => id !== svcId) : [...prev, svcId]
    );
  };

  // Update a field value for a service
  const updateFieldValue = (serviceId: string, fieldKey: string, value: any) => {
    setServiceValues((prev) => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  // Save all requirements
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // 1. Save requirements for each selected service
      for (const sId of selectedServiceIds) {
        const vals = serviceValues[sId] || {};
        await crmApi.saveLeadTravelServiceRequirement(leadId, sId, vals);
      }

      // 2. Also sync to Lead.extension['crm-travel']
      if (lead) {
        const currentExt = lead.extension && typeof lead.extension === 'object' ? lead.extension : {};
        const updatedTravel = {
          ...(currentExt['crm-travel'] || {}),
          selectedServiceIds,
          requirements: serviceValues,
          updatedAt: new Date().toISOString(),
        };
        await crmApi.updateLead(leadId, {
          extension: {
            ...currentExt,
            'crm-travel': updatedTravel,
          },
        });
      }

      setMessage({ kind: 'success', text: 'Travel requirements saved successfully!' });
      if (onUpdated) onUpdated();
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save travel requirements.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Group configured fields by serviceId
  const fieldsByService = useMemo(() => {
    const map = new Map<string, RequirementFieldItem[]>();
    for (const f of fields) {
      if (!f.enabled && f.enabled !== undefined) continue;
      for (const sId of f.serviceIds || []) {
        if (!map.has(sId)) map.set(sId, []);
        map.get(sId)!.push(f);
      }
    }
    return map;
  }, [fields]);

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Header Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
            <FlightTakeoffIcon sx={{ fontSize: 20 }} />
          </div>
          <div>
            <h3 className="m-0 text-sm font-bold text-zinc-950 dark:text-zinc-50">
              Travel Requirements for this Lead
            </h3>
            <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Select the required services below to reveal and fill out the dynamic requirements configured by the Admin.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 cursor-pointer border-0 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <SaveIcon sx={{ fontSize: 16 }} />
          {saving ? 'Saving…' : 'Save Travel Requirements'}
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs font-medium ${
            message.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {message.kind === 'success' ? (
            <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
          ) : (
            <ErrorOutlineIcon sx={{ fontSize: 18 }} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Services Requirement Selection (Checkboxes) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col gap-3">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
          Services Required for this Lead:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {services.map((svc) => {
            const checked = selectedServiceIds.includes(svc.id);
            const count = (fieldsByService.get(svc.id) || []).length;
            return (
              <label
                key={svc.id}
                className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                  checked
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                    : 'border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(svc.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5 text-xs font-semibold select-none">
                    {svc.icon}
                    {svc.label}
                  </span>
                </div>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    checked
                      ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500">Loading travel forms…</div>
      ) : selectedServiceIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-400 dark:border-zinc-800">
          No services selected for this lead. Check at least one service above to fill in travel requirements.
        </div>
      ) : (
        /* Sections for each selected service */
        <div className="flex flex-col gap-6">
          {selectedServiceIds.map((sId) => {
            const svc = services.find((s) => s.id === sId) || {
              id: sId,
              label: sId.toUpperCase(),
              icon: getServiceIcon(sId),
            };
            const svcFields = fieldsByService.get(sId) || [];
            const currentVals = serviceValues[sId] || {};

            return (
              <div
                key={sId}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col gap-4"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                      {svc.icon}
                    </span>
                    <h4 className="m-0 text-sm font-bold text-zinc-950 dark:text-zinc-50">
                      {svc.label} Requirements
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400">
                    {svcFields.length} configured {svcFields.length === 1 ? 'field' : 'fields'}
                  </span>
                </div>

                {svcFields.length === 0 ? (
                  <p className="m-0 text-xs text-zinc-400 py-3 italic">
                    No custom fields configured for {svc.label} yet. (Admin can add fields from the Travel requirement module).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {svcFields.map((field) => {
                      const val = currentVals[field.fieldKey];

                      return (
                        <div
                          key={field.fieldId}
                          className={`flex flex-col gap-1.5 ${
                            field.type === 'textarea' ? 'md:col-span-2' : ''
                          }`}
                        >
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {field.name}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>

                          {/* 1. Input Field (Text) */}
                          {field.type === 'text' && (
                            <input
                              type="text"
                              value={val ?? ''}
                              placeholder={field.placeholder || `Enter ${field.name}…`}
                              onChange={(e) =>
                                updateFieldValue(sId, field.fieldKey, e.target.value)
                              }
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          )}

                          {/* 2. Number Input */}
                          {field.type === 'number' && (
                            <input
                              type="number"
                              value={val ?? ''}
                              placeholder={field.placeholder || '0'}
                              onChange={(e) =>
                                updateFieldValue(sId, field.fieldKey, e.target.value)
                              }
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          )}

                          {/* 3. Date Field */}
                          {field.type === 'date' && (
                            <input
                              type="date"
                              value={val ?? ''}
                              onChange={(e) =>
                                updateFieldValue(sId, field.fieldKey, e.target.value)
                              }
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          )}

                          {/* 4. Textarea */}
                          {field.type === 'textarea' && (
                            <textarea
                              rows={3}
                              value={val ?? ''}
                              placeholder={field.placeholder || `Enter ${field.name}…`}
                              onChange={(e) =>
                                updateFieldValue(sId, field.fieldKey, e.target.value)
                              }
                              className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-y"
                            />
                          )}

                          {/* 5. Selection Field / Single Select */}
                          {field.type === 'select' && (
                            <select
                              value={val ?? ''}
                              onChange={(e) =>
                                updateFieldValue(sId, field.fieldKey, e.target.value)
                              }
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                              <option value="">-- Select {field.name} --</option>
                              {(field.options || []).map((opt, i) => (
                                <option key={i} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* 6. Multiple Choose Field / Multi Select */}
                          {field.type === 'multiselect' && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {(field.options || []).map((opt, i) => {
                                const selectedList: string[] = Array.isArray(val) ? val : [];
                                const isSel = selectedList.includes(opt);
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      const next = isSel
                                        ? selectedList.filter((x) => x !== opt)
                                        : [...selectedList, opt];
                                      updateFieldValue(sId, field.fieldKey, next);
                                    }}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold border cursor-pointer transition-all ${
                                      isSel
                                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* 7. Checkbox / Multiple Choice */}
                          {field.type === 'checkbox' && (
                            <div className="flex flex-col gap-1.5 pt-1">
                              {(field.options || []).map((opt, i) => {
                                const checkedList: string[] = Array.isArray(val) ? val : [];
                                const isChecked = checkedList.includes(opt);
                                return (
                                  <label
                                    key={i}
                                    className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const next = isChecked
                                          ? checkedList.filter((x) => x !== opt)
                                          : [...checkedList, opt];
                                        updateFieldValue(sId, field.fieldKey, next);
                                      }}
                                      className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* 8. Radio Field */}
                          {field.type === 'radio' && (
                            <div className="flex flex-wrap gap-4 pt-1">
                              {(field.options || []).map((opt, i) => (
                                <label
                                  key={i}
                                  className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    name={`${sId}_${field.fieldKey}`}
                                    value={opt}
                                    checked={val === opt}
                                    onChange={() => updateFieldValue(sId, field.fieldKey, opt)}
                                    className="h-4 w-4 border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {field.helpText && (
                            <span className="text-[11px] text-zinc-400 mt-0.5">
                              {field.helpText}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Save Bar at bottom */}
      <div className="sticky bottom-4 z-20 rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          All filled requirement values are stored in the dedicated database table.
        </span>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 cursor-pointer border-0 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <SaveIcon sx={{ fontSize: 16 }} />
          {saving ? 'Saving…' : 'Save Travel Requirements'}
        </button>
      </div>
    </div>
  );
};
