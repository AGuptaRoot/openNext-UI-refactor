import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, X } from 'lucide-react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { useAuth } from '../../context/AuthContext';
import { extensionDataApi } from '../../services/extensionDataApi';
import { ExtensionFieldInput } from './ExtensionFieldInput';
import { useExtensionSettingsValues } from './useExtensionSettings';
import { addSettingOption, settingKeyOf, OPTION_TYPES, SETTINGS_MANAGE } from '../../utils/addSettingOption';
import {
  emitValuesChanged,
  fieldWidthClass,
  invalidFieldValue,
  resolveFieldOptions,
  withFormulas,
} from '../../utils/extensionFieldLogic';
import { useNotifyMessage } from '@/components/notifications';
import type { ExtensionFieldDef, ExtensionFieldGroup, ExtensionRecordType } from '../../types/extensions';

interface ExtensionFieldsSectionProps {
  record: ExtensionRecordType;
  recordId: string;
  requestTypeKey?: string;
  groupId?: string; // Limit to specific group (used by fields tabs)
  /** Values only, no Edit button (e.g. a record the page edits elsewhere). */
  readOnly?: boolean;
}

const RECORD_PERMISSIONS: Record<ExtensionRecordType, string> = {
  lead: 'crm.leads.write',
  client: 'crm.clients.write',
  opportunity: 'crm.opportunities.write',
  ticket: 'crm.tickets.write',
  quotation: 'crm.quotes.write',
};

/**
 * Declared extension fields on a detail page, one card per field group, each
 * with its own Edit / Save. Generic: dynamic options (optionsFrom), calculated
 * fields (formula), widths and hidden fields come from the declaration. After a
 * save the page is told (crm:extension-values-changed) so mounted extension UIs
 * can refresh.
 */
export const ExtensionFieldsSection: React.FC<ExtensionFieldsSectionProps> = ({
  record,
  recordId,
  requestTypeKey,
  groupId,
  readOnly = false,
}) => {
  const { extension, declarations } = useActiveExtension();
  const { hasPermission, isClient } = useAuth();
  const canEdit = !readOnly && hasPermission(RECORD_PERMISSIONS[record]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useNotifyMessage(error, 'error', () => setError(null));
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<Record<string, unknown>>({});
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});

  const applicableGroups = useMemo<ExtensionFieldGroup[]>(() => {
    const allGroups = declarations.fields?.[record] || [];
    return allGroups
      .filter((g) => {
        if (groupId && g.id !== groupId) return false;
        if (record === 'lead' && g.whenRequestTypeKey) {
          if (!requestTypeKey || g.whenRequestTypeKey !== requestTypeKey) return false;
        }
        return true;
      })
      // Client (portal) users never see team-only fields; a group left with none is not shown.
      .map((g) => (isClient ? { ...g, fields: g.fields.filter((f) => !f.internal) } : g))
      // A group whose every field is hidden is not shown either.
      .filter((g) => g.fields.some((f) => !f.hidden));
  }, [declarations.fields, record, requestTypeKey, groupId, isClient]);

  const allFields = useMemo<ExtensionFieldDef[]>(() => applicableGroups.flatMap((g) => g.fields), [applicableGroups]);
  const settingsValues = useExtensionSettingsValues(allFields.some((f) => f.optionsFrom));

  useEffect(() => {
    if (!applicableGroups.length || !recordId) {
      setLoading(false);
      return undefined;
    }
    let isMounted = true;
    setLoading(true);
    setError(null);
    extensionDataApi
      .getValues(record, recordId)
      .then((res) => {
        if (!isMounted) return;
        setSavedValues(res.values || {});
        setDraftValues(res.values || {});
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load extension fields');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [record, recordId, applicableGroups.length]);

  if (!applicableGroups.length) return null;

  const startEdit = (id: string) => {
    setDraftValues(savedValues);
    setEditingGroup(id);
    setError(null);
  };

  const handleCancel = () => {
    setDraftValues(savedValues);
    setEditingGroup(null);
    setError(null);
  };

  const handleSave = async (group: ExtensionFieldGroup) => {
    setSaving(true);
    setError(null);
    try {
      // Send only this group's editable fields; formulas are recomputed on the server.
      const patch: Record<string, unknown> = {};
      for (const field of group.fields) {
        if (field.formula || field.readOnly || field.hidden) continue;
        if (draftValues[field.key] !== undefined) patch[field.key] = draftValues[field.key];
      }
      // The server's rules first (dates, numbers, options), so the agent sees the problem at once.
      const problem = invalidFieldValue(group.fields, { ...savedValues, ...patch }, settingsValues, savedValues);
      if (problem) {
        setError(problem);
        return;
      }
      const res = await extensionDataApi.setValues(record, recordId, patch);
      setSavedValues(res.values || {});
      setDraftValues(res.values || {});
      setEditingGroup(null);
      emitValuesChanged(record, recordId, res.values || {});
    } catch (err: unknown) {
      const details = (err as { details?: unknown }).details;
      setError(
        Array.isArray(details) && details.length
          ? details.map(String).join(' · ')
          : (err as Error)?.message || 'Failed to save'
      );
    } finally {
      setSaving(false);
    }
  };

  // CRM 3.43.1: a typed name is kept only when it really joined the options list (see addSettingOption).
  const handleAddOptionForField = async (field: ExtensionFieldDef, newVal: string) => {
    const result = await addSettingOption({
      extensionId: extension.id,
      settingKey: settingKeyOf(field),
      name: newVal,
      label: field.label,
      settingsValues,
      canManageSettings: hasPermission(SETTINGS_MANAGE),
    });
    if (!result.ok && OPTION_TYPES.has(field.type)) {
      setError(result.message);
      return;
    }
    const value = result.ok ? result.value : newVal; // free-text field: suggestions only
    setDraftValues((prev) => withFormulas(allFields, { ...prev, [field.key]: value }));
  };

  return (
    <div className="space-y-5">
      {applicableGroups.map((group) => {
        const editing = editingGroup === group.id;
        const shown = editing ? draftValues : savedValues;
        return (
          <section
            key={group.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h3 className="m-0 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{group.sectionLabel}</h3>
              {canEdit && !loading && (
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={saving}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSave(group)}
                        disabled={saving}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border-0 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden /> {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(group.id)}
                      disabled={editingGroup !== null}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-40"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden /> Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-zinc-400">Loading…</div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                {group.fields
                  .filter((field) => !field.hidden)
                  .map((field) => (
                    <div key={field.key} className={fieldWidthClass(field)}>
                      <ExtensionFieldInput
                        field={field.optionsFrom ? { ...field, options: resolveFieldOptions(field, settingsValues) } : field}
                        value={shown[field.key]}
                        onChange={(val) => setDraftValues((prev) => withFormulas(allFields, { ...prev, [field.key]: val }))}
                        onAddOption={editing ? (newVal) => void handleAddOptionForField(field, newVal) : undefined}
                        readOnly={!editing || Boolean(field.readOnly || field.formula)}
                        values={shown}
                      />
                    </div>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
