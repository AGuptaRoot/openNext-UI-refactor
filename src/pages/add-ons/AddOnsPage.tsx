import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import HotelIcon from '@mui/icons-material/Hotel';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import LocalAirportIcon from '@mui/icons-material/LocalAirport';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LuggageIcon from '@mui/icons-material/Luggage';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import CategoryIcon from '@mui/icons-material/Category';
import TrainIcon from '@mui/icons-material/Train';
import { crmApi } from '../../services/api';
import { useDialog } from '../../context/DialogContext';

const DRAFT_OPTIONS_STORAGE_KEY = 'opennext_travel_field_options_draft';

export interface ServiceDef {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export function getServiceIcon(idOrName: string): React.ReactNode {
  const lower = idOrName.toLowerCase();
  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('resort') || lower.includes('room')) {
    return <HotelIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('air') || lower.includes('flight') || lower.includes('plane')) {
    return <LocalAirportIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('bus')) {
    return <DirectionsBusIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('cab') || lower.includes('car') || lower.includes('transport') || lower.includes('taxi')) {
    return <DirectionsCarIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('package') || lower.includes('tour') || lower.includes('holiday') || lower.includes('trip')) {
    return <LuggageIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('visa') || lower.includes('passport')) {
    return <AssignmentIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('cruise') || lower.includes('boat') || lower.includes('ship')) {
    return <DirectionsBoatIcon sx={{ fontSize: 18 }} />;
  }
  if (lower.includes('train') || lower.includes('rail')) {
    return <TrainIcon sx={{ fontSize: 18 }} />;
  }
  return <CategoryIcon sx={{ fontSize: 18 }} />;
}

export function serviceNameToDef(name: string): ServiceDef {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    id,
    label: name,
    icon: getServiceIcon(name),
  };
}

export const DEFAULT_SERVICES: ServiceDef[] = [
  { id: 'hotel', label: 'Hotel', icon: <HotelIcon sx={{ fontSize: 18 }} /> },
  { id: 'air_ticket', label: 'Air Ticket / Flight', icon: <LocalAirportIcon sx={{ fontSize: 18 }} /> },
  { id: 'bus_ticket', label: 'Bus Ticket', icon: <DirectionsBusIcon sx={{ fontSize: 18 }} /> },
  { id: 'transport', label: 'Cab / Transport', icon: <DirectionsCarIcon sx={{ fontSize: 18 }} /> },
  { id: 'tour_package', label: 'Tour Package', icon: <LuggageIcon sx={{ fontSize: 18 }} /> },
  { id: 'visa', label: 'Visa Assistance', icon: <AssignmentIcon sx={{ fontSize: 18 }} /> },
  { id: 'cruise', label: 'Cruise', icon: <DirectionsBoatIcon sx={{ fontSize: 18 }} /> },
];

export const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: '1. Input Field (Text)' },
  { value: 'number', label: '2. Number Input' },
  { value: 'date', label: '3. Date Field' },
  { value: 'textarea', label: '4. Textarea' },
  { value: 'select', label: '5. Selection Field / Single Select' },
  { value: 'multiselect', label: '6. Multiple Choose Field / Multi Select' },
  { value: 'checkbox', label: '7. Checkbox / Multiple Choice' },
  { value: 'radio', label: '8. Radio Field' },
];

export interface RequirementFieldItem {
  fieldId: string;
  fieldKey: string;
  name: string;
  type: string;
  serviceIds: string[];
  options: string[];
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  displayOrder?: number;
  enabled?: boolean;
}

export const AddOnsPage: React.FC = () => {
  const { confirm: confirmDialog } = useDialog();
  const [services, setServices] = useState<ServiceDef[]>(DEFAULT_SERVICES);
  const [customServiceName, setCustomServiceName] = useState('');
  const [showAddService, setShowAddService] = useState(false);

  // Form states
  const [selectedServices, setSelectedServices] = useState<string[]>(['hotel']);
  const [inputName, setInputName] = useState('');
  const [inputType, setInputType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const [helpText, setHelpText] = useState('');

  // Chip options state for select / multiselect / checkbox / radio
  const [options, setOptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_OPTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  });
  const [newOptionDraft, setNewOptionDraft] = useState('');

  // Persist draft options to localStorage whenever they change
  useEffect(() => {
    try {
      if (options.length > 0) {
        localStorage.setItem(DRAFT_OPTIONS_STORAGE_KEY, JSON.stringify(options));
      } else {
        localStorage.removeItem(DRAFT_OPTIONS_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [options]);

  // Load configured travel services from settings
  useEffect(() => {
    let cancelled = false;
    crmApi.getTravelServices().then((res) => {
      if (cancelled) return;
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const loaded = res.data.map(serviceNameToDef);
        setServices(loaded);
        setSelectedServices((prev) => (prev.length > 0 ? prev : [loaded[0].id]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Created fields list
  const [fields, setFields] = useState<RequirementFieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  const needsOptions = ['select', 'multiselect', 'checkbox', 'radio'].includes(inputType);

  // Open / View field in Modal
  const [viewingField, setViewingField] = useState<RequirementFieldItem | null>(null);

  // Edit State & URL sync
  const [searchParams, setSearchParams] = useSearchParams();
  const editParam = searchParams.get('edit');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(editParam || null);
  const editingField = useMemo(() => {
    if (!editingFieldId) return null;
    return fields.find((f) => f.fieldId === editingFieldId) || null;
  }, [editingFieldId, fields]);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('text');
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editNewOptionDraft, setEditNewOptionDraft] = useState('');
  const [editRequired, setEditRequired] = useState(false);
  const [editPlaceholder, setEditPlaceholder] = useState('');
  const [editHelpText, setEditHelpText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Sync edit form with editingField
  useEffect(() => {
    if (editingField) {
      setEditName(editingField.name || '');
      setEditType(editingField.type || 'text');
      setEditServiceIds(editingField.serviceIds || []);
      setEditOptions(Array.isArray(editingField.options) ? [...editingField.options] : []);
      setEditRequired(!!editingField.required);
      setEditPlaceholder(editingField.placeholder || '');
      setEditHelpText(editingField.helpText || '');
      setEditNewOptionDraft('');
    }
  }, [editingField]);

  // Sync URL search param with edit state
  useEffect(() => {
    if (editParam && editParam !== editingFieldId) {
      setEditingFieldId(editParam);
    } else if (!editParam && editingFieldId) {
      setEditingFieldId(null);
    }
  }, [editParam]);

  const handleStartEditField = (field: RequirementFieldItem) => {
    setEditingFieldId(field.fieldId);
    setSearchParams({ edit: field.fieldId });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingFieldId(null);
    setSearchParams({});
    setMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField) return;
    setMessage(null);

    const cleanName = editName.trim();
    if (!cleanName) {
      setMessage({ kind: 'error', text: 'Please enter an Input Name.' });
      return;
    }

    if (!editServiceIds.length) {
      setMessage({ kind: 'error', text: 'Please select at least one Service requirement.' });
      return;
    }

    const needsEditOptions = ['select', 'multiselect', 'checkbox', 'radio'].includes(editType);
    if (needsEditOptions && !editOptions.length) {
      setMessage({
        kind: 'error',
        text: `Please add at least one option for ${FIELD_TYPE_OPTIONS.find((t) => t.value === editType)?.label || editType}.`,
      });
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        name: cleanName,
        type: editType,
        serviceIds: editServiceIds,
        options: needsEditOptions ? editOptions : [],
        required: editRequired,
        placeholder: editPlaceholder.trim(),
        helpText: editHelpText.trim(),
      };
      const res = await crmApi.updateTravelRequirementField(editingField.fieldId, payload);
      if (res && res.success !== false) {
        setFields((prev) =>
          prev.map((f) => (f.fieldId === editingField.fieldId ? { ...f, ...payload } : f))
        );
        setMessage({ kind: 'success', text: `Field "${cleanName}" updated successfully in database!` });
        setEditingFieldId(null);
        setSearchParams({});
      } else {
        setMessage({ kind: 'error', text: res?.message || 'Failed to update field.' });
      }
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Error updating requirement field.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Load created fields on mount
  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getTravelRequirementFields({ all: true });
      if (res && res.data) {
        setFields(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  // Option chip management
  const addOption = () => {
    const clean = newOptionDraft.trim();
    if (!clean) return;
    if (options.some((opt) => opt.toLowerCase() === clean.toLowerCase())) {
      setNewOptionDraft('');
      return;
    }
    setOptions((prev) => [...prev, clean]);
    setNewOptionDraft('');
  };

  const removeOption = (indexToRemove: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const selectAllServices = () => {
    setSelectedServices(services.map((s) => s.id));
  };

  const deselectAllServices = () => {
    setSelectedServices([]);
  };

  // Add custom service
  const handleAddCustomService = async () => {
    const clean = customServiceName.trim();
    if (!clean) return;
    const newDef = serviceNameToDef(clean);
    if (!services.some((s) => s.id === newDef.id)) {
      const updated = [...services, newDef];
      setServices(updated);
      setSelectedServices((prev) => [...prev, newDef.id]);
      try {
        await crmApi.saveTravelServices(updated.map((s) => s.label));
      } catch {
        /* ignore */
      }
    } else {
      setSelectedServices((prev) => (prev.includes(newDef.id) ? prev : [...prev, newDef.id]));
    }
    setCustomServiceName('');
    setShowAddService(false);
  };

  // Submit and create field in dedicated standalone table
  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedServices.length) {
      setMessage({ kind: 'error', text: 'Please select at least one Service requirement checkbox.' });
      return;
    }

    const cleanName = inputName.trim();
    if (!cleanName) {
      setMessage({ kind: 'error', text: 'Please enter an Input Name.' });
      return;
    }

    if (needsOptions && options.length === 0) {
      setMessage({
        kind: 'error',
        text: `Please add at least one option for the ${FIELD_TYPE_OPTIONS.find((t) => t.value === inputType)?.label}.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await crmApi.createTravelRequirementField({
        name: cleanName,
        type: inputType,
        serviceIds: selectedServices,
        options: needsOptions ? options : [],
        required: isRequired,
        placeholder: placeholder.trim(),
        helpText: helpText.trim(),
      });

      if (res && res.success !== false) {
        // Clear draft from localStorage on successful field save
        localStorage.removeItem(DRAFT_OPTIONS_STORAGE_KEY);
        setOptions([]);
        setInputName('');
        setPlaceholder('');
        setHelpText('');
        setIsRequired(false);
        setMessage({
          kind: 'success',
          text: `Field "${cleanName}" created successfully in dedicated database table!`,
        });
        await loadFields();
      } else {
        setMessage({ kind: 'error', text: res?.error || 'Failed to create field.' });
      }
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Error creating requirement field.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete field (Safe non-blocking dialog that works in sandboxed iframes)
  const handleDeleteField = async (fieldId: string, fieldName: string) => {
    const ok = await confirmDialog({
      message: `Are you sure you want to delete requirement field "${fieldName}"?`,
      tone: 'danger',
      confirmLabel: 'Delete'
    });
    if (!ok) return;
    try {
      await crmApi.deleteTravelRequirementField(fieldId);
      setFields((prev) => prev.filter((f) => f.fieldId !== fieldId));
      setMessage({ kind: 'success', text: `Field "${fieldName}" deleted.` });
    } catch (err) {
      setMessage({ kind: 'error', text: 'Failed to delete field.' });
    }
  };

  // Filtered fields
  const filteredFields = useMemo(() => {
    if (serviceFilter === 'all') return fields;
    return fields.filter((f) => (f.serviceIds || []).includes(serviceFilter));
  }, [fields, serviceFilter]);

  const serviceLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((s) => map.set(s.id, s.label));
    return map;
  }, [services]);

  return (
    <div className="flex w-full flex-col gap-6 p-1 max-w-7xl mx-auto">
      {/* Notification Banner */}
      {message && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium ${
            message.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.kind === 'success' ? (
              <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            ) : (
              <ErrorOutlineIcon sx={{ fontSize: 18 }} />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="border-0 bg-transparent text-current opacity-70 hover:opacity-100 cursor-pointer p-0"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
      )}

      {editingFieldId ? (
        /* Dedicated Edit Particular Field View */
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-none transition-colors"
            >
              <ArrowBackIcon sx={{ fontSize: 16 }} />
              <span>Back to Travel Requirements</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Field ID:</span>
              <code className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {editingField?.fieldId || editingFieldId}
              </code>
            </div>
          </div>

          {!editingField ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                {loading ? 'Loading field details…' : 'Field not found or has been removed.'}
              </p>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer border-0"
              >
                <ArrowBackIcon sx={{ fontSize: 16 }} />
                <span>Return to Fields List</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col gap-6">
              <div className="flex items-start gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                  <EditIcon sx={{ fontSize: 24 }} />
                </div>
                <div>
                  <h1 className="m-0 text-lg font-bold text-zinc-950 dark:text-zinc-50">
                    Edit Requirement Field: {editingField.name}
                  </h1>
                  <p className="m-0 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Modify input name, input type, assigned services, options list, or required status. Changes will update the dedicated table and reflect in leads immediately.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveEdit} className="flex flex-col gap-6">
                {/* 1. Services Requirement Checkboxes */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      1. Assigned Services Requirement <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditServiceIds(services.map((s) => s.id))}
                        className="text-[11px] font-semibold text-blue-600 hover:underline bg-transparent border-0 cursor-pointer p-0"
                      >
                        Select all
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={() => setEditServiceIds([])}
                        className="text-[11px] font-semibold text-zinc-500 hover:underline bg-transparent border-0 cursor-pointer p-0"
                      >
                        Deselect all
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {services.map((svc) => {
                      const checked = editServiceIds.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                            checked
                              ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                              : 'border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setEditServiceIds((prev) =>
                                prev.includes(svc.id) ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                              );
                            }}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
                          />
                          <span className="flex items-center gap-1.5 text-xs font-semibold select-none">
                            {svc.icon}
                            {svc.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Input Name and 3. Input Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      2. Input Name / Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Room Type, Meal Plan, Seat Preference..."
                      className="h-10 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      3. Input Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="h-10 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 cursor-pointer"
                    >
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Options Chip List Editor (shown if type is select/multiselect/checkbox/radio) */}
                {['select', 'multiselect', 'checkbox', 'radio'].includes(editType) && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                          4. Options List for {FIELD_TYPE_OPTIONS.find((t) => t.value === editType)?.label} <span className="text-red-500">*</span>
                        </label>
                        <p className="m-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                          Define choices available for travelers or agents to pick.
                        </p>
                      </div>
                      {editOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditOptions([])}
                          className="text-[11px] font-semibold text-red-500 hover:underline bg-transparent border-0 cursor-pointer p-0"
                        >
                          Clear all options
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editNewOptionDraft}
                        onChange={(e) => setEditNewOptionDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = editNewOptionDraft.trim();
                            if (val && !editOptions.includes(val)) {
                              setEditOptions([...editOptions, val]);
                              setEditNewOptionDraft('');
                            }
                          }
                        }}
                        placeholder="Type option value and press Enter or click + Add..."
                        className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = editNewOptionDraft.trim();
                          if (val && !editOptions.includes(val)) {
                            setEditOptions([...editOptions, val]);
                            setEditNewOptionDraft('');
                          }
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer border-0"
                      >
                        <AddIcon sx={{ fontSize: 16 }} />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      {editOptions.length === 0 ? (
                        <span className="text-xs text-zinc-400 italic">No options added yet. Type above and click Add.</span>
                      ) : (
                        editOptions.map((opt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            <span>{opt}</span>
                            <button
                              type="button"
                              onClick={() => setEditOptions(editOptions.filter((_, i) => i !== idx))}
                              className="border-0 bg-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-0"
                            >
                              <CloseIcon sx={{ fontSize: 13 }} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Validation & Assistance */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Placeholder (Optional)
                    </label>
                    <input
                      type="text"
                      value={editPlaceholder}
                      onChange={(e) => setEditPlaceholder(e.target.value)}
                      placeholder="e.g. Choose preferred room..."
                      className="h-10 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Help Text (Optional)
                    </label>
                    <input
                      type="text"
                      value={editHelpText}
                      onChange={(e) => setEditHelpText(e.target.value)}
                      placeholder="e.g. Visible to travel agents"
                      className="h-10 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={editRequired}
                        onChange={(e) => setEditRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
                      />
                      <span>Required Field (Mandatory)</span>
                    </label>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-none"
                  >
                    Cancel & Back
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 cursor-pointer border-0 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                    {savingEdit ? 'Saving changes…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      ) : (
        /* Standard View: Create Form Card + Configured Fields List */
        <>
          {/* Top Banner / Header */}
          <header className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <FlightTakeoffIcon sx={{ fontSize: 28 }} />
              </div>
              <div>
                <h1 className="m-0 text-xl font-bold text-zinc-950 dark:text-zinc-50">
                  Travel Requirement Form Builder
                </h1>
                <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Select Services, enter Field Name and choose Input Type to configure dynamic requirement forms stored in the dedicated database table.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadFields}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Refresh List
            </button>
          </header>

          {/* Main Creation Card */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="m-0 text-base font-bold text-zinc-950 dark:text-zinc-50 mb-1">
              Create New Requirement Field
            </h2>
            <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Inputs created here appear under the <strong>Travel Requirement</strong> tab on individual Lead pages when matching travel services are selected.
            </p>

        <form onSubmit={handleCreateField} className="flex flex-col gap-6">
          {/* 1. Services Requirement Checkboxes */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                1. Select Services Requirement <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllServices}
                  className="text-[11px] font-semibold text-blue-600 hover:underline bg-transparent border-0 cursor-pointer p-0"
                >
                  Select all
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={deselectAllServices}
                  className="text-[11px] font-semibold text-zinc-500 hover:underline bg-transparent border-0 cursor-pointer p-0"
                >
                  Deselect all
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => setShowAddService(!showAddService)}
                  className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 hover:underline bg-transparent border-0 cursor-pointer p-0"
                >
                  + Add custom service
                </button>
              </div>
            </div>

            {/* Custom service addition input */}
            {showAddService && (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                <input
                  type="text"
                  placeholder="New service name (e.g. Travel Insurance, Forex)..."
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomService())}
                  className="h-8 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={handleAddCustomService}
                  className="h-8 rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white cursor-pointer border-0 hover:bg-zinc-800"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddService(false)}
                  className="h-8 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Checkbox chips/cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {services.map((svc) => {
                const checked = selectedServices.includes(svc.id);
                return (
                  <label
                    key={svc.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                      checked
                        ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
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
                  </label>
                );
              })}
            </div>
          </div>

          {/* 2. Field Name & Input Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                2. Input Name / Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Room Type, Meal Preference, Seat Category..."
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                3. Input Type <span className="text-red-500">*</span>
              </label>
              <select
                value={inputType}
                onChange={(e) => setInputType(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Options Section (Shown for Selection Field, Multi Choose, Checkbox, Radio) */}
          {needsOptions && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    4. Add Field Options (Chip List)
                  </h3>
                  <p className="m-0 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Type an option and click <strong>Add</strong> or press <strong>Enter</strong>. Options draft is kept in local storage until saved.
                  </p>
                </div>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {options.length} options
                </span>
              </div>

              {/* Option Input + Add Button */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Deluxe Room, Executive Suite, Window Seat..."
                  value={newOptionDraft}
                  onChange={(e) => setNewOptionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  className="h-9 flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-zinc-950 px-4 text-xs font-semibold text-white cursor-pointer border-0 hover:bg-zinc-800"
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                  Add
                </button>
              </div>

              {/* Chips Container */}
              <div className="min-h-[52px] rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                {options.length === 0 ? (
                  <p className="m-0 text-center text-xs text-zinc-400 py-2">
                    No options added yet. Type an option above and click Add.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt, idx) => (
                      <span
                        key={`${opt}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border-0 bg-zinc-200 text-zinc-500 hover:bg-zinc-900 hover:text-white dark:bg-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                          <CloseIcon sx={{ fontSize: 10 }} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Optional Configurations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                Placeholder Text (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Choose preferred option..."
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                Help / Tooltip Text (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Specify any dietary preference..."
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-0 cursor-pointer"
                />
                Required field on Lead form
              </label>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 cursor-pointer border-0 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <AddIcon sx={{ fontSize: 18 }} />
              {submitting ? 'Creating field…' : 'Create Field in Standalone Table'}
            </button>
          </div>
        </form>
      </section>

      {/* Configured Fields List Section */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-bold text-zinc-950 dark:text-zinc-50">
              Configured Requirement Fields ({filteredFields.length})
            </h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Persisted in dedicated standalone collection <code>plugin_openext_crm_suite_travel_requirement_fields</code>.
            </p>
          </div>

          {/* Filter by Service */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setServiceFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                serviceFilter === 'all'
                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              All Services
            </button>
            {services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => setServiceFilter(svc.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                  serviceFilter === svc.id
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {svc.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500">Loading requirement fields…</div>
        ) : filteredFields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-400 dark:border-zinc-800">
            No requirement fields configured {serviceFilter !== 'all' ? `for ${serviceLabelMap.get(serviceFilter) || serviceFilter}` : ''}. Use the form above to create your first field.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <th className="py-3 px-3 font-semibold">Field Name</th>
                  <th className="py-3 px-3 font-semibold">Input Type</th>
                  <th className="py-3 px-3 font-semibold">Assigned Services</th>
                  <th className="py-3 px-3 font-semibold">Options</th>
                  <th className="py-3 px-3 font-semibold">Required</th>
                  <th className="py-3 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredFields.map((field) => {
                  const typeLabel =
                    FIELD_TYPE_OPTIONS.find((t) => t.value === field.type)?.label || field.type;
                  return (
                    <tr key={field.fieldId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-3 px-3 font-bold text-zinc-950 dark:text-zinc-100">
                        {field.name}
                        {field.placeholder && (
                          <span className="block text-[11px] font-normal text-zinc-400">
                            Placeholder: {field.placeholder}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(field.serviceIds || []).map((sId) => (
                            <span
                              key={sId}
                              className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                            >
                              {serviceLabelMap.get(sId) || sId}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {field.options && field.options.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {field.options.map((opt, i) => (
                              <span
                                key={i}
                                className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              >
                                {opt}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {field.required ? (
                          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-200">
                            Required
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">Optional</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingField(field)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-none transition-colors"
                            title="Open Field Only View"
                          >
                            <VisibilityIcon sx={{ fontSize: 14 }} />
                            <span>Open</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditField(field)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
                            title="Edit Field"
                          >
                            <EditIcon sx={{ fontSize: 15 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.fieldId, field.name)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 cursor-pointer"
                            title="Delete Field"
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      )}

      {/* Field Only View Modal */}
      {viewingField && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all"
          onClick={() => setViewingField(null)}
        >
          <div
            className="flex w-full max-w-xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                  <VisibilityIcon sx={{ fontSize: 18 }} />
                </span>
                <div>
                  <h3 className="m-0 text-sm font-bold text-zinc-950 dark:text-zinc-50">
                    Field View: {viewingField.name}
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {viewingField.fieldId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingField(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 border-0 bg-transparent cursor-pointer p-0"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-5 p-6 overflow-y-auto max-h-[75vh]">
              {/* Live Interactive Input Preview */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    Live Form Field Preview
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    (How this appears to users)
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span>
                      {viewingField.name} {viewingField.required && <span className="text-red-500">*</span>}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                      {FIELD_TYPE_OPTIONS.find((t) => t.value === viewingField.type)?.label || viewingField.type}
                    </span>
                  </label>

                  {/* Render based on type */}
                  {viewingField.type === 'textarea' ? (
                    <textarea
                      placeholder={viewingField.placeholder || 'Enter text details...'}
                      rows={3}
                      disabled
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 opacity-90 cursor-default resize-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                  ) : viewingField.type === 'date' ? (
                    <input
                      type="date"
                      disabled
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 opacity-90 cursor-default dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                  ) : viewingField.type === 'number' ? (
                    <input
                      type="number"
                      placeholder={viewingField.placeholder || '0'}
                      disabled
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 opacity-90 cursor-default dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                  ) : viewingField.type === 'select' ? (
                    <select
                      disabled
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 opacity-90 cursor-default dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <option>{viewingField.placeholder || '-- Select an option --'}</option>
                      {(viewingField.options || []).map((opt, i) => (
                        <option key={i}>{opt}</option>
                      ))}
                    </select>
                  ) : viewingField.type === 'multiselect' ? (
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                      {(viewingField.options || []).length === 0 ? (
                        <span className="text-xs text-zinc-400 italic">No options defined</span>
                      ) : (
                        (viewingField.options || []).map((opt, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600"
                          >
                            {opt}
                          </span>
                        ))
                      )}
                    </div>
                  ) : viewingField.type === 'checkbox' ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {(viewingField.options || []).length === 0 ? (
                        <span className="text-xs text-zinc-400 italic">No choices defined</span>
                      ) : (
                        (viewingField.options || []).map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                            <input type="checkbox" disabled checked={i === 0} className="h-4 w-4 rounded" />
                            <span>{opt}</span>
                          </label>
                        ))
                      )}
                    </div>
                  ) : viewingField.type === 'radio' ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {(viewingField.options || []).length === 0 ? (
                        <span className="text-xs text-zinc-400 italic">No choices defined</span>
                      ) : (
                        (viewingField.options || []).map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                            <input type="radio" disabled checked={i === 0} className="h-4 w-4" />
                            <span>{opt}</span>
                          </label>
                        ))
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={viewingField.placeholder || 'Enter value...'}
                      disabled
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 opacity-90 cursor-default dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                  )}

                  {viewingField.helpText && (
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      {viewingField.helpText}
                    </span>
                  )}
                </div>
              </div>

              {/* Field Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Input Type
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {FIELD_TYPE_OPTIONS.find((t) => t.value === viewingField.type)?.label || viewingField.type}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Requirement Status
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {viewingField.required ? (
                      <span className="text-red-600 font-bold">Required (Mandatory)</span>
                    ) : (
                      <span className="text-zinc-500">Optional</span>
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Field Key
                  </span>
                  <code className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                    {viewingField.fieldKey}
                  </code>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Field ID
                  </span>
                  <code className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                    {viewingField.fieldId}
                  </code>
                </div>
              </div>

              {/* Assigned Services */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Assigned Services ({(viewingField.serviceIds || []).length})
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(viewingField.serviceIds || []).map((sId) => (
                    <span
                      key={sId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                    >
                      {getServiceIcon(sId)}
                      <span>{serviceLabelMap.get(sId) || sId}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Options list if available */}
              {viewingField.options && viewingField.options.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Defined Options ({viewingField.options.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingField.options.map((opt, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-white border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <button
                type="button"
                onClick={() => setViewingField(null)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer shadow-none"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewingField;
                  setViewingField(null);
                  handleStartEditField(target);
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer border-0"
              >
                <EditIcon sx={{ fontSize: 16 }} />
                <span>Edit this field</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
