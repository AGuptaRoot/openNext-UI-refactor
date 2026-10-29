import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { crmApi } from '../../services/api';
import {
  ExtensionFieldsSlot,
  loadFieldLogic,
  resolveExtensionFields,
  type ExtensionFieldDef,
  type FieldLogicContext,
  type FieldLogicModule,
} from '../extensions/ExtensionFieldsSlot';
import type {
  ExtensionClientFieldGroup,
  ExtensionClientTab,
} from '../../hooks/useExtensions';
import type {
  ClientPassport,
  ClientRecordSummary,
} from '../../types/clients';
import type { ConfirmOptions } from '../../context/DialogContext';

export interface ClientPassportsTabProps {
  clientId: string;
  tab: ExtensionClientTab;
  /** Field group declared by the extension (schema + logic URLs). */
  group: ExtensionClientFieldGroup | null;
  leadId: string | null;
  canWrite: boolean;
  showToast: (message: string) => void;
  /** Host confirm dialog (useDialog) — keeps styling consistent. */
  confirm: (messageOrOptions: string | ConfirmOptions) => Promise<boolean>;
}

/** The subset of a record the extension's fields may write. */
type PassportFieldPatch = Partial<
  Pick<ClientPassport, 'fullname' | 'passport_number' | 'Date_of_issue' | 'Date_of_expiry'>
>;

function toPatch(values: Record<string, unknown>): PassportFieldPatch {
  const str = (value: unknown) => (value == null ? '' : String(value));
  return {
    fullname: str(values.fullname),
    passport_number: str(values.passport_number),
    Date_of_issue: str(values.Date_of_issue),
    Date_of_expiry: str(values.Date_of_expiry),
  };
}

/** Field types the CRM renders itself rather than through the field grid. */
const FILE_FIELD_TYPES = new Set(['image', 'file', 'upload']);

const EMPTY_SUMMARY: ClientRecordSummary = {
  uploaded: 0,
  allowed: null,
  missing: 0,
  overLimit: 0,
  canUploadMore: true,
  countLabel: 'records',
  message: '',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Client Passports tab.
 *
 * Ownership split: field definitions, labels and validation come from the
 * extension package (`group.schemaUrl` / `group.logicUrl`); upload, OCR,
 * storage and the record list are owned by the CRM plugin.
 */
export const ClientPassportsTab: React.FC<ClientPassportsTabProps> = ({
  clientId,
  tab,
  group,
  leadId,
  canWrite,
  showToast,
  confirm,
}) => {
  const slot = useMemo(
    () => ({ extensionId: tab.extensionId, tabId: tab.id }),
    [tab.extensionId, tab.id]
  );

  const [records, setRecords] = useState<ClientPassport[]>([]);
  const [summary, setSummary] = useState<ClientRecordSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const [fields, setFields] = useState<ExtensionFieldDef[]>([]);
  const [logic, setLogic] = useState<FieldLogicModule | null>(null);
  const [fieldsReady, setFieldsReady] = useState(false);

  /** Editing buffer per record id, keyed by extension field id. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---- extension-owned field schema + logic -------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFieldsReady(false);
      if (!group) {
        if (!cancelled) {
          setFields([]);
          setLogic(null);
          setFieldsReady(true);
        }
        return;
      }
      const mod = await loadFieldLogic(group.logicUrl);
      const resolved = await resolveExtensionFields(group.fields || [], group.schemaUrl, mod);
      if (cancelled) return;
      setLogic(mod);
      setFields(resolved.sort((a, b) => (a.order || 100) - (b.order || 100)));
      setFieldsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [group]);

  const imageField = useMemo(
    () => fields.find((f) => FILE_FIELD_TYPES.has(String(f.fieldType))) || null,
    [fields]
  );
  const dataFields = useMemo(
    () => fields.filter((f) => !FILE_FIELD_TYPES.has(String(f.fieldType))),
    [fields]
  );

  // ---- records ------------------------------------------------------------

  const applyPayload = useCallback(
    (payload: { records?: ClientPassport[]; summary?: ClientRecordSummary }) => {
      const next = Array.isArray(payload.records) ? payload.records : [];
      setRecords(next);
      setSummary(payload.summary || EMPTY_SUMMARY);
      setDrafts({});
      setFieldErrors({});
    },
    []
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmApi.listClientPassports(clientId, slot);
      applyPayload(res.data || {});
    } catch (reason) {
      setRecords([]);
      setSummary(EMPTY_SUMMARY);
      setError(reason instanceof Error ? reason.message : `Failed to load ${tab.label}`);
    } finally {
      setLoading(false);
    }
  }, [clientId, slot, applyPayload, tab.label]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ---- upload -------------------------------------------------------------

  const openPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;

      // Client-side cap so the user sees the limit before any request.
      const room =
        summary.allowed == null ? files.length : Math.max(0, summary.allowed - summary.uploaded);
      if (room <= 0) {
        showToast(
          summary.allowed == null
            ? 'No more uploads allowed'
            : `All ${summary.allowed} ${summary.countLabel} are already uploaded`
        );
        return;
      }

      const accepted = files.slice(0, room);
      const rejected = files.length - accepted.length;

      setUploading(true);
      let uploaded = 0;
      let scanned = 0;
      let lastPayload: { records?: ClientPassport[]; summary?: ClientRecordSummary } | null = null;

      try {
        // Sequential: each upload re-checks the cap server-side.
        for (const file of accepted) {
          const res = await crmApi.uploadClientPassport(clientId, file, slot);
          lastPayload = res.data || null;
          uploaded += 1;
          if (res.data?.ocrApplied) scanned += 1;
        }
      } catch (reason) {
        showToast(reason instanceof Error ? reason.message : 'Passport upload failed');
      } finally {
        setUploading(false);
        if (lastPayload) applyPayload(lastPayload);
        else await reload();
      }

      if (uploaded > 0) {
        const parts = [`${uploaded} ${uploaded === 1 ? 'passport' : 'passports'} uploaded`];
        if (scanned > 0) parts.push(`${scanned} scanned`);
        if (rejected > 0) parts.push(`${rejected} skipped (traveller limit)`);
        showToast(parts.join(' · '));
      } else if (rejected > 0) {
        showToast(`${rejected} skipped — traveller limit reached`);
      }
    },
    [applyPayload, clientId, reload, showToast, slot, summary]
  );

  // ---- editing ------------------------------------------------------------

  const draftFor = useCallback(
    (record: ClientPassport): Record<string, unknown> => {
      const existing = drafts[record.id];
      if (existing) return existing;
      if (logic?.fromRecord) {
        return logic.fromRecord(record as unknown as Record<string, unknown>);
      }
      return {
        fullname: record.fullname || '',
        passport_number: record.passport_number || '',
        Date_of_issue: record.Date_of_issue || '',
        Date_of_expiry: record.Date_of_expiry || '',
      };
    },
    [drafts, logic]
  );

  const setDraft = useCallback((recordId: string, values: Record<string, unknown>) => {
    setDrafts((prev) => ({ ...prev, [recordId]: values }));
  }, []);

  const isDirty = useCallback(
    (record: ClientPassport) => {
      const draft = drafts[record.id];
      if (!draft) return false;
      const target = logic?.toRecord ? logic.toRecord(draft) : toPatch(draft);
      return (
        String(target.fullname ?? '') !== String(record.fullname || '') ||
        String(target.passport_number ?? '') !== String(record.passport_number || '') ||
        String(target.Date_of_issue ?? '') !== String(record.Date_of_issue || '') ||
        String(target.Date_of_expiry ?? '') !== String(record.Date_of_expiry || '')
      );
    },
    [drafts, logic]
  );

  const save = useCallback(
    async (record: ClientPassport) => {
      const draft = draftFor(record);
      const context: FieldLogicContext = {
        today: todayIso(),
        records: records as unknown as Array<Record<string, unknown>>,
        recordId: record.id,
      };

      // Required-field check from the extension schema, then its own validate().
      for (const field of dataFields) {
        if (!field.required) continue;
        const value = draft[field.id];
        if (value == null || String(value).trim() === '') {
          setFieldErrors((prev) => ({
            ...prev,
            [record.id]: `${field.label || field.id} is required`,
          }));
          return;
        }
      }
      if (logic?.validate) {
        const issues = logic.validate(draft, context) || [];
        if (issues.length) {
          setFieldErrors((prev) => ({
            ...prev,
            [record.id]: issues[0].message || 'Passport details are invalid',
          }));
          return;
        }
      }

      const body = toPatch(logic?.toRecord ? logic.toRecord(draft) : draft);

      setSavingId(record.id);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[record.id];
        return next;
      });
      try {
        const res = await crmApi.updateClientPassport(clientId, record.id, body, slot);
        applyPayload(res.data || {});
        showToast('Passport updated');
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Failed to update passport';
        setFieldErrors((prev) => ({ ...prev, [record.id]: message }));
      } finally {
        setSavingId(null);
      }
    },
    [applyPayload, clientId, dataFields, draftFor, logic, records, showToast, slot]
  );

  const remove = useCallback(
    async (record: ClientPassport) => {
      const label = record.fullname || record.fileName || 'this passport';
      const ok = await confirm({
        title: 'Remove passport',
        message: `Remove ${label}? The stored scan is deleted from storage as well.`,
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        const res = await crmApi.deleteClientPassport(clientId, record.id, slot);
        applyPayload(res.data || {});
        showToast('Passport removed');
      } catch (reason) {
        showToast(reason instanceof Error ? reason.message : 'Failed to remove passport');
      }
    },
    [applyPayload, clientId, confirm, showToast, slot]
  );

  const rescan = useCallback(
    async (record: ClientPassport) => {
      setScanningId(record.id);
      try {
        const res = await crmApi.rescanClientPassport(clientId, record.id, slot);
        applyPayload(res.data || {});
        showToast('Passport re-scanned');
      } catch (reason) {
        showToast(reason instanceof Error ? reason.message : 'Re-scan failed');
      } finally {
        setScanningId(null);
      }
    },
    [applyPayload, clientId, showToast, slot]
  );

  // ---- render -------------------------------------------------------------

  const context: FieldLogicContext = useMemo(
    () => ({ today: todayIso(), records: records as unknown as Array<Record<string, unknown>> }),
    [records]
  );

  const canUpload = canWrite && summary.canUploadMore && !uploading;
  const uploadLabel = imageField?.label || 'passport image';

  return (
    <div className="flex flex-col gap-4" data-tour={`clients-tab-${tab.id}-panel`}>
      {/* Hint + traveller source */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
        {tab.hintMessage || 'Upload one passport per traveller.'}
        {summary.allowed != null ? (
          <>
            {' '}
            The limit of {summary.allowed} comes from the traveller count on the source lead.
          </>
        ) : null}
        {leadId ? (
          <>
            {' '}
            <Link
              to={`/leads/${leadId}`}
              className="font-semibold text-zinc-900 no-underline hover:underline"
            >
              View source lead
            </Link>
          </>
        ) : null}
      </div>

      {/* Count banner */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Uploaded
          </span>
          <strong className="text-sm font-bold text-zinc-950">
            {summary.uploaded}
            {summary.allowed != null ? ` / ${summary.allowed}` : ''}
          </strong>
        </div>

        {summary.missing > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
            <WarningAmberIcon sx={{ fontSize: 16 }} />
            {summary.message}
          </div>
        ) : summary.overLimit > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
            <WarningAmberIcon sx={{ fontSize: 16 }} />
            {summary.message}
          </div>
        ) : summary.allowed != null && summary.uploaded === summary.allowed ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
            All {summary.allowed} {summary.countLabel} uploaded
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={imageField?.accept || 'image/jpeg,image/png,image/webp'}
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={!canUpload}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold border cursor-pointer ${
              canUpload
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
            }`}
            title={
              !canWrite
                ? 'You do not have permission to upload passports'
                : !summary.canUploadMore
                  ? `All ${summary.allowed} ${summary.countLabel} are already uploaded`
                  : `Upload ${uploadLabel}`
            }
          >
            <UploadFileIcon sx={{ fontSize: 15 }} />
            {uploading ? 'Uploading…' : `Upload ${uploadLabel}`}
          </button>
        </div>
      </div>

      {!group ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          The {tab.extensionId} extension did not declare field definitions for this tab. Enable the
          extension, then reload.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {/* Records */}
      {loading || !fieldsReady ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-xs text-zinc-500">
          Loading {tab.label.toLowerCase()}…
        </div>
      ) : !records.length ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
          <p className="m-0 text-xs font-medium text-zinc-500">
            No {summary.countLabel} uploaded yet
            {summary.allowed != null ? ` — ${summary.allowed} expected` : ''}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {records.map((record, index) => {
            const draft = draftFor(record);
            const notices = logic?.warnings
              ? logic.warnings(record as unknown as Record<string, unknown>, context)
              : [];
            const summaryLine = logic?.summarizeRecord
              ? logic.summarizeRecord(record as unknown as Record<string, unknown>)
              : record.fullname || record.fileName || `Passport ${index + 1}`;
            const dirty = isDirty(record);
            const rowError = fieldErrors[record.id];

            return (
              <div
                key={record.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
                data-testid={`client-passport-${record.id}`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* Stored scan */}
                  <a
                    href={record.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                    title="Open full size"
                  >
                    <img
                      src={record.url}
                      alt={summaryLine}
                      className="h-24 w-36 object-cover"
                      loading="lazy"
                    />
                  </a>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-bold text-zinc-950">
                        {index + 1}. {summaryLine}
                      </strong>
                      {record.ocr?.extractionMode === 'vision' ? (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                          {record.ocr.mrzParsed ? 'Scanned · MRZ' : 'Scanned'}
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Not scanned
                        </span>
                      )}
                    </div>

                    <p className="m-0 mt-1 text-[11px] text-zinc-500">
                      Issued {formatDate(record.Date_of_issue)} · Expires{' '}
                      {formatDate(record.Date_of_expiry)}
                      {record.createdByName ? ` · Added by ${record.createdByName}` : ''}
                    </p>

                    {notices.map((notice) => (
                      <p
                        key={notice.message}
                        className={`m-0 mt-1.5 text-[11px] font-semibold ${
                          notice.level === 'error' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {notice.message}
                      </p>
                    ))}

                    {record.ocr?.error ? (
                      <p className="m-0 mt-1.5 text-[11px] text-zinc-500">
                        Scan unavailable: {record.ocr.error}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => void rescan(record)}
                        disabled={scanningId === record.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-semibold text-zinc-700 cursor-pointer"
                        title="Read the details from the stored scan again"
                      >
                        <DocumentScannerIcon sx={{ fontSize: 15 }} />
                        {scanningId === record.id ? 'Scanning…' : 'Re-scan'}
                      </button>
                    ) : null}
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => void remove(record)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold text-red-700 cursor-pointer"
                        title="Remove this passport"
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Extension-declared fields */}
                {group && dataFields.length ? (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <h4 className="m-0 mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      {group.sectionLabel}
                      <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-400">
                        from {group.extensionId}
                      </span>
                    </h4>
                    <ExtensionFieldsSlot
                      groups={[
                        {
                          extensionId: group.extensionId,
                          // Empty label suppresses the slot's own header — the
                          // record card already names the section.
                          sectionLabel: '',
                          // Schema already resolved here — do not refetch per row.
                          fields: dataFields.map((f) => ({
                            ...f,
                            readOnly: f.readOnly || !canWrite,
                          })),
                          logicUrl: group.logicUrl,
                          order: group.order,
                        },
                      ]}
                      valuesByExtension={{ [group.extensionId]: draft }}
                      onChange={(_extensionId, values) => setDraft(record.id, values)}
                      titleClassName="m-0 mb-1 text-xs font-bold text-zinc-950"
                      inputClassName="h-9 px-3 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 w-full box-border"
                    />

                    {rowError ? (
                      <p className="m-0 mt-2 text-[11px] font-semibold text-red-700">{rowError}</p>
                    ) : null}

                    {canWrite ? (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void save(record)}
                          disabled={!dirty || savingId === record.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold border cursor-pointer ${
                            dirty && savingId !== record.id
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                          }`}
                        >
                          <SaveIcon sx={{ fontSize: 15 }} />
                          {savingId === record.id ? 'Saving…' : 'Save details'}
                        </button>
                        {dirty ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDrafts((prev) => {
                                const next = { ...prev };
                                delete next[record.id];
                                return next;
                              })
                            }
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-semibold text-zinc-700 cursor-pointer"
                          >
                            Discard
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
