import React, { useState, useRef, useMemo, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Download,
  PartyPopper,
  Rocket,
  Search,
  Settings,
} from 'lucide-react';

import { crmApi } from '../../services/api';
import { triggerFileDownload } from '../../utils/fileDownload';
import {
  parseCsvString,
  generateSampleLeadCsv,
  generateSampleClientCsv,
} from '../../utils/csvParser';

export type ImportEntityType = 'leads' | 'clients';

interface CsvImportModalProps {
  isOpen: boolean;
  entityType: ImportEntityType;
  onClose: () => void;
  onSuccess: () => void;
  stages?: string[];
  sources?: string[];
  statuses?: string[];
  categories?: string[];
}

interface PreviewRow {
  rowIndex: number;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  stage?: string;
  category?: string;
  status?: string;
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  duplicates?: string[];
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  entityType,
  onClose,
  onSuccess,
  stages = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'],
  sources = ['Website', 'LinkedIn', 'Referral', 'Cold Call', 'Google Ads', 'Other'],
  statuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost', 'Disqualified'],
  categories = ['Enterprise', 'SMB', 'Startup', 'Government', 'Retail', 'Partner'],
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Settings
  const [defaultStage, setDefaultStage] = useState(stages[0] || 'New');
  const [defaultSource, setDefaultSource] = useState(sources[0] || 'Website');
  const [defaultStatus, setDefaultStatus] = useState(statuses[0] || 'New');
  const [defaultCategory, setDefaultCategory] = useState(categories[0] || 'Enterprise');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [allowSimilarCompany, setAllowSimilarCompany] = useState(true);

  // Preview state
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [kpiCounts, setKpiCounts] = useState({
    total: 0,
    valid: 0,
    warning: 0,
    error: 0,
  });

  // Result state
  const [resultSummary, setResultSummary] = useState({
    created: 0,
    skipped: 0,
    failed: 0,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setPastedText('');
      setShowPasteBox(false);
      setErrorMessage('');
      setPreviewRows([]);
      setResultSummary({ created: 0, skipped: 0, failed: 0 });
    }
  }, [isOpen]);

  const isLeads = entityType === 'leads';
  const entityLabel = isLeads ? 'Leads' : 'Clients';

  // Handle sample download
  const handleDownloadSample = () => {
    const csvContent = isLeads ? generateSampleLeadCsv() : generateSampleClientCsv();
    const filename = isLeads ? 'leads_import_sample_template.csv' : 'clients_sample_import.csv';
    triggerFileDownload({
      filename,
      content: csvContent,
      format: 'csv',
    });
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.csv') || f.name.endsWith('.tsv') || f.name.endsWith('.txt') || f.type.includes('csv') || f.type.includes('tab')) {
        setFile(f);
        setErrorMessage('');
      } else {
        setErrorMessage('Please drop a valid .csv / .tsv file.');
      }
    }
  };

  // Step 1 -> Step 2: Analyze & Preview
  const handleAnalyze = async () => {
    setErrorMessage('');
    setAnalyzing(true);

    try {
      let content = pastedText.trim();
      if (file) {
        content = await file.text();
      }

      if (!content) {
        setErrorMessage('Please select a CSV file or paste tabular data first.');
        setAnalyzing(false);
        return;
      }

      const parsedRows = parseCsvString(content);
      if (!parsedRows.length) {
        setErrorMessage('Could not parse any rows from the CSV content. Check format.');
        setAnalyzing(false);
        return;
      }

      if (isLeads) {
        const previewRes = await crmApi.previewLeadImport({
          rows: parsedRows,
          options: {
            defaultStage,
            defaultSource,
            defaultStatus,
            skipDuplicates,
            allowSimilarCompany,
          },
        });

        const data = previewRes.data;
        const rows: PreviewRow[] = (data.rows || []).map((r) => ({
          rowIndex: r.rowIndex,
          name: r.name,
          company: r.company,
          email: r.email,
          phone: r.phone,
          stage: r.stage,
          status: r.status,
          valid: r.valid,
          errors: r.errors,
          warnings: r.warnings,
          duplicates: r.duplicates,
        }));

        setPreviewRows(rows);
        setKpiCounts({
          total: data.totalRows || rows.length,
          valid: data.validCount || rows.filter((r) => r.valid).length,
          warning: data.warningCount || rows.filter((r) => (r.warnings?.length || 0) > 0).length,
          error: data.errorCount || rows.filter((r) => !r.valid).length,
        });
      } else {
        const previewRes = await crmApi.previewClientImport({
          rows: parsedRows,
          options: {
            defaultCategory,
            defaultStatus,
            skipDuplicates,
            allowSimilarCompany,
          },
        });

        const data = previewRes.data;
        const rows: PreviewRow[] = (data.rows || []).map((r) => ({
          rowIndex: r.rowIndex,
          name: r.name,
          company: r.company || r.name,
          email: r.email,
          phone: r.phone,
          category: r.category,
          status: r.status,
          valid: r.valid,
          errors: r.errors,
          warnings: r.warnings,
          duplicates: r.duplicates,
        }));

        setPreviewRows(rows);
        setKpiCounts({
          total: data.total || data.totalRows || rows.length,
          valid: data.valid || data.validCount || rows.filter((r) => r.valid).length,
          warning: data.warningCount || rows.filter((r) => (r.warnings?.length || 0) > 0).length,
          error: data.invalid || data.errorCount || rows.filter((r) => !r.valid).length,
        });
      }

      setStep(2);
      setPreviewFilter('all');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // Step 2 -> Step 3: Execute Import
  const handleExecuteImport = async () => {
    setExecuting(true);
    setErrorMessage('');

    try {
      let content = pastedText.trim();
      if (file) {
        content = await file.text();
      }
      const parsedRows = parseCsvString(content);

      if (isLeads) {
        const res = await crmApi.executeLeadImport({
          rows: parsedRows,
          options: {
            defaultStage,
            defaultSource,
            defaultStatus,
            skipDuplicates,
            allowSimilarCompany,
          },
        });
        const d = res.data;
        setResultSummary({
          created: d.createdCount || 0,
          skipped: d.skippedCount || 0,
          failed: d.failedCount || 0,
        });
      } else {
        const res = await crmApi.executeClientImport({
          rows: parsedRows,
          options: {
            defaultCategory,
            defaultStatus,
            skipDuplicates,
            allowSimilarCompany,
          },
        });
        const d = res.data;
        setResultSummary({
          created: d.createdCount ?? d.created ?? 0,
          skipped: d.skippedCount ?? d.skipped ?? 0,
          failed: d.failedCount ?? d.failed ?? 0,
        });
      }

      setStep(3);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Import execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  const filteredRows = useMemo(() => {
    if (previewFilter === 'valid') {
      return previewRows.filter((r) => r.valid && (!r.warnings || r.warnings.length === 0));
    }
    if (previewFilter === 'warning') {
      return previewRows.filter((r) => (r.warnings?.length || 0) > 0);
    }
    if (previewFilter === 'error') {
      return previewRows.filter((r) => !r.valid);
    }
    return previewRows;
  }, [previewRows, previewFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <Download className="h-[18px] w-[18px] shrink-0 text-zinc-700" aria-hidden />
            <div>
              <h2 className="m-0 text-base font-bold text-zinc-950">Bulk Import {entityLabel}</h2>
              <p className="m-0 text-xs text-zinc-500">
                Upload a CSV file or paste tabular data with row-level validation and duplicate detection.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-zinc-300 bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <ErrorOutlineIcon sx={{ fontSize: 16 }} className="text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: FILE UPLOAD & PRESETS */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-xs text-zinc-700 uppercase tracking-wider">
                  Step 1: Choose File or Paste CSV Data
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors"
                >
                  <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                  isDragOver
                    ? 'border-zinc-950 bg-zinc-100'
                    : 'border-zinc-300 bg-zinc-50/50 hover:bg-zinc-100/50'
                }`}
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 40 }} className="text-zinc-400" />
                <div className="text-sm font-bold text-zinc-900">
                  {file ? file.name : 'Drag & drop your CSV file here'}
                </div>
                <div className="text-xs text-zinc-500">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB · Click to change file`
                    : 'or click to browse (.csv, .tsv, .txt — comma, tab, or semicolon)'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircleOutlineIcon sx={{ fontSize: 16 }} className="text-emerald-700" />
                    <span>Selected: <strong>{file.name}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-red-600 hover:text-red-800 text-xs font-semibold cursor-pointer border-none bg-transparent"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Collapsible Paste Text Area */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="w-full text-left px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100/80 border-none flex items-center justify-between text-xs font-semibold text-zinc-700 cursor-pointer"
                >
                  <span>Or paste CSV / tabular text manually</span>
                  <span className="text-zinc-400">{showPasteBox ? '▲' : '▼'}</span>
                </button>
                {showPasteBox && (
                  <div className="p-3 border-t border-zinc-200">
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={
                        isLeads
                          ? 'Name,Company,Email,Phone,Stage,Source\nJohn Doe,Acme Corp,john@acme.com,9876543210,New,Website'
                          : 'Company Name,Company Email,Company Phone,Category,Status\nAcme Corp,contact@acme.com,+91 9876543210,Enterprise,Active'
                      }
                      className="w-full rounded-lg border border-zinc-300 p-2.5 text-xs font-mono text-zinc-800 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                    />
                  </div>
                )}
              </div>

              {/* Import Options / Defaults */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                  <Settings className="h-4 w-4 shrink-0" aria-hidden />
                  Import Settings & Defaults
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {isLeads ? (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-500 block mb-1">
                          Default Stage (if missing)
                        </label>
                        <select
                          value={defaultStage}
                          onChange={(e) => setDefaultStage(e.target.value)}
                          className="w-full h-8 rounded-lg border border-zinc-300 px-2 text-xs bg-white"
                        >
                          {stages.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-500 block mb-1">
                          Default Source (if missing)
                        </label>
                        <select
                          value={defaultSource}
                          onChange={(e) => setDefaultSource(e.target.value)}
                          className="w-full h-8 rounded-lg border border-zinc-300 px-2 text-xs bg-white"
                        >
                          {sources.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-500 block mb-1">
                          Default Status (if missing)
                        </label>
                        <select
                          value={defaultStatus}
                          onChange={(e) => setDefaultStatus(e.target.value)}
                          className="w-full h-8 rounded-lg border border-zinc-300 px-2 text-xs bg-white"
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-500 block mb-1">
                          Default Category (if missing)
                        </label>
                        <select
                          value={defaultCategory}
                          onChange={(e) => setDefaultCategory(e.target.value)}
                          className="w-full h-8 rounded-lg border border-zinc-300 px-2 text-xs bg-white"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-500 block mb-1">
                          Default Status (if missing)
                        </label>
                        <select
                          value={defaultStatus}
                          onChange={(e) => setDefaultStatus(e.target.value)}
                          className="w-full h-8 rounded-lg border border-zinc-300 px-2 text-xs bg-white"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded text-zinc-950 focus:ring-zinc-950"
                    />
                    <span><strong>Skip exact duplicates</strong> (recommended)</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowSimilarCompany}
                      onChange={(e) => setAllowSimilarCompany(e.target.checked)}
                      className="rounded text-zinc-950 focus:ring-zinc-950"
                    />
                    <span>Allow entries with similar company names</span>
                  </label>
                </div>
              </div>

              {/* Supported Columns Guide Table */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">
                    <HelpOutlineIcon sx={{ fontSize: 15 }} className="text-zinc-500" />
                    Supported Fields & CSV Column Format Guide
                  </span>
                  <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-200/70 px-2 py-0.5 rounded">
                    * Required fields
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-50/80 sticky top-0 border-b border-zinc-200 text-zinc-500 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="p-2 pl-3">Field Name</th>
                        <th className="p-2">Accepted Column Headers</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 pr-3">Example Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {isLeads ? (
                        <>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Lead Name *</td>
                            <td className="p-2 font-mono text-[11px]">Name, Full Name, Lead Name</td>
                            <td className="p-2 font-semibold text-red-600">Required</td>
                            <td className="p-2 pr-3 text-zinc-500">John Doe</td>
                          </tr>
                          <tr className="bg-zinc-50/40">
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Company Name *</td>
                            <td className="p-2 font-mono text-[11px]">Company, Company Name, Company name</td>
                            <td className="p-2 font-semibold text-red-600">Required</td>
                            <td className="p-2 pr-3 text-zinc-500">Acme Technologies</td>
                          </tr>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Email Address *</td>
                            <td className="p-2 font-mono text-[11px]">Email, Email Address</td>
                            <td className="p-2 font-semibold text-red-600">Required</td>
                            <td className="p-2 pr-3 text-zinc-500">john.doe@acme.com</td>
                          </tr>
                          <tr className="bg-zinc-50/40">
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Mobile / Phone *</td>
                            <td className="p-2 font-mono text-[11px]">Phone, Mobile, Contact</td>
                            <td className="p-2 font-semibold text-red-600">Required</td>
                            <td className="p-2 pr-3 text-zinc-500">+91 9876543210</td>
                          </tr>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Pipeline Stage</td>
                            <td className="p-2 font-mono text-[11px]">Stage, Pipeline Stage</td>
                            <td className="p-2 text-zinc-500">Optional</td>
                            <td className="p-2 pr-3 text-zinc-500">New, Contacted, Won</td>
                          </tr>
                          <tr className="bg-zinc-50/40">
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Lead Source</td>
                            <td className="p-2 font-mono text-[11px]">Source, Lead Source</td>
                            <td className="p-2 text-zinc-500">Optional</td>
                            <td className="p-2 pr-3 text-zinc-500">Website, LinkedIn, Referral</td>
                          </tr>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Budget / Value</td>
                            <td className="p-2 font-mono text-[11px]">Value, Budget, Budget / Value</td>
                            <td className="p-2 text-zinc-500">Optional Number</td>
                            <td className="p-2 pr-3 text-zinc-500">75000</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Company Name *</td>
                            <td className="p-2 font-mono text-[11px]">Company Name, Company, Name</td>
                            <td className="p-2 font-semibold text-red-600">Required</td>
                            <td className="p-2 pr-3 text-zinc-500">Acme Corporation</td>
                          </tr>
                          <tr className="bg-zinc-50/40">
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Company Email</td>
                            <td className="p-2 font-mono text-[11px]">Company Email, Email, Email Address</td>
                            <td className="p-2 text-zinc-500">Optional</td>
                            <td className="p-2 pr-3 text-zinc-500">contact@acme.com</td>
                          </tr>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Company Phone</td>
                            <td className="p-2 font-mono text-[11px]">Company Phone, Phone, Mobile</td>
                            <td className="p-2 text-zinc-500">Optional</td>
                            <td className="p-2 pr-3 text-zinc-500">+91 98765 43210</td>
                          </tr>
                          <tr className="bg-zinc-50/40">
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Tax ID / GSTIN</td>
                            <td className="p-2 font-mono text-[11px]">Tax ID, GSTIN, VAT</td>
                            <td className="p-2 text-zinc-500">Optional</td>
                            <td className="p-2 pr-3 text-zinc-500">TAX-2026-0001</td>
                          </tr>
                          <tr>
                            <td className="p-2 pl-3 font-semibold text-zinc-900">Primary Contact</td>
                            <td className="p-2 font-mono text-[11px]">Contact Name, Primary Contact</td>
                            <td className="p-2 text-zinc-500">Optional</td>
                            <td className="p-2 pr-3 text-zinc-500">John Smith</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION RESULTS */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Valid & Ready
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">
                    {kpiCounts.valid}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">Passed all checks</div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/80">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Warnings
                  </div>
                  <div className="text-2xl font-extrabold text-amber-700 mt-0.5">
                    {kpiCounts.warning}
                  </div>
                  <div className="text-[10px] text-amber-600 mt-0.5">Duplicate / notice</div>
                </div>

                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/80">
                  <div className="text-[11px] font-bold text-red-800 uppercase tracking-wider">
                    Errors
                  </div>
                  <div className="text-2xl font-extrabold text-red-700 mt-0.5">
                    {kpiCounts.error}
                  </div>
                  <div className="text-[10px] text-red-600 mt-0.5">Missing required field</div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
                  <div className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                    Total Rows
                  </div>
                  <div className="text-2xl font-extrabold text-zinc-900 mt-0.5">
                    {kpiCounts.total}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Parsed from CSV</div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-2">
                {[
                  { id: 'all', label: `All Rows (${kpiCounts.total})` },
                  { id: 'valid', label: `Ready (${kpiCounts.valid})` },
                  { id: 'warning', label: `Warnings (${kpiCounts.warning})` },
                  { id: 'error', label: `Errors (${kpiCounts.error})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewFilter(tab.id as typeof previewFilter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                      previewFilter === tab.id
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-white text-zinc-600 hover:bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Preview Table */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-50/90 sticky top-0 border-b border-zinc-200 text-zinc-500 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="p-2.5 pl-3 w-12">#</th>
                      <th className="p-2.5 w-24">Status</th>
                      <th className="p-2.5">Name & Company</th>
                      <th className="p-2.5">Contact Details</th>
                      <th className="p-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredRows.length > 0 ? (
                      filteredRows.map((r) => {
                        const hasErrors = !r.valid;
                        const hasWarnings = (r.warnings?.length || 0) > 0;

                        return (
                          <tr key={r.rowIndex} className="hover:bg-zinc-50/70">
                            <td className="p-2.5 pl-3 text-zinc-400 font-mono text-[11px]">
                              {r.rowIndex}
                            </td>
                            <td className="p-2.5">
                              {hasErrors ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  <ErrorOutlineIcon sx={{ fontSize: 12 }} /> Error
                                </span>
                              ) : hasWarnings ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <WarningAmberIcon sx={{ fontSize: 12 }} /> Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircleOutlineIcon sx={{ fontSize: 12 }} /> Ready
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <div className="font-semibold text-zinc-900">{r.name || '—'}</div>
                              <div className="text-[11px] text-zinc-500">{r.company || '—'}</div>
                            </td>
                            <td className="p-2.5">
                              <div className="text-zinc-700">{r.email || '—'}</div>
                              <div className="text-[11px] text-zinc-500">{r.phone || '—'}</div>
                            </td>
                            <td className="p-2.5">
                              {hasErrors ? (
                                <div className="text-red-600 font-medium">
                                  {(r.errors || []).join('; ')}
                                </div>
                              ) : hasWarnings ? (
                                <div className="text-amber-700 font-medium">
                                  {(r.warnings || []).join('; ')}
                                </div>
                              ) : (
                                <div className="text-emerald-700 font-medium">
                                  Ready to import ({r.stage || r.category || r.status || 'Standard'})
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-400">
                          No rows match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETION / RESULT SUMMARY */}
          {step === 3 && (
            <div className="py-8 text-center flex flex-col items-center justify-center gap-3">
              <PartyPopper className="h-12 w-12 shrink-0 text-emerald-600" aria-hidden />
              <h3 className="text-lg font-bold text-zinc-900 m-0">Import Completed!</h3>
              <p className="text-xs text-zinc-500 max-w-sm m-0">
                Your batch import for {entityLabel} was successfully processed.
              </p>

              <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-3 px-6 mt-2 text-xs">
                <div>Created: <strong className="text-emerald-700 font-bold">{resultSummary.created}</strong></div>
                <div>Skipped: <strong className="text-amber-700 font-bold">{resultSummary.skipped}</strong></div>
                <div>Failed: <strong className="text-red-700 font-bold">{resultSummary.failed}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <button
            type="button"
            onClick={step === 3 ? handleFinish : onClose}
            disabled={analyzing || executing}
            className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50"
          >
            {step === 3 ? 'Close' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={executing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50"
              >
                <ArrowBackIcon sx={{ fontSize: 14 }} />
                <span>Back to File</span>
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || (!file && !pastedText.trim())}
                className="px-4 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none shadow-xs transition-colors disabled:opacity-50"
              >
                {analyzing ? (
                  'Analyzing CSV…'
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Search className="h-4 w-4 shrink-0" aria-hidden />
                    Analyze & Preview
                  </span>
                )}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={executing || kpiCounts.valid === 0}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold cursor-pointer border-none shadow-xs transition-colors disabled:opacity-50"
              >
                {executing ? (
                  'Importing…'
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Rocket className="h-4 w-4 shrink-0" aria-hidden />
                    {`Import ${kpiCounts.valid} Valid ${entityLabel}`}
                  </span>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleFinish}
                className="px-4 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer border-none shadow-xs transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
