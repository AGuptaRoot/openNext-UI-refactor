import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined';

import { ApiError, crmApi } from '../../services/api';
import type { FinancePdfDocumentType, FinancePdfOcrExtractResult } from '../../types/financePdfOcr';
import { pdfFileToImageDataUrls } from '../../utils/pdfToImages';
import { saveFinancePdfScanDraft } from '../../utils/financePdfScanDraft';

interface FinancePdfScanModalProps {
  open: boolean;
  onClose: () => void;
  documentType: FinancePdfDocumentType;
}

export const FinancePdfScanModal: React.FC<FinancePdfScanModalProps> = ({
  open,
  onClose,
  documentType,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FinancePdfOcrExtractResult | null>(null);

  const label = documentType === 'quotation' ? 'Quotation' : 'Invoice';
  const createPath = documentType === 'quotation' ? '/quotations/create' : '/invoices/create';

  const reset = () => {
    setFile(null);
    setBusy(false);
    setStatus(null);
    setError(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const runScan = async (pdf: File) => {
    setBusy(true);
    setError(null);
    setPreview(null);
    setStatus('Reading PDF pages…');
    try {
      const { imageDataUrls, pageCount } = await pdfFileToImageDataUrls(pdf, {
        maxPages: 6,
        scale: 1.4,
        quality: 0.7,
      });
      setStatus(`Scanning ${Math.min(pageCount, imageDataUrls.length)} page(s) with AI…`);
      const res =
        documentType === 'quotation'
          ? await crmApi.extractQuotationFromPdf({ imageDataUrls })
          : await crmApi.extractInvoiceFromPdf({ imageDataUrls });
      if (!res.data) throw new Error(res.error || 'No data extracted');
      setPreview(res.data);
      setStatus(
        `Extracted ${res.data.items?.length || 0} line item(s)` +
          (res.data.documentNumber ? ` · #${res.data.documentNumber}` : '')
      );
    } catch (err: unknown) {
      const text =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to scan PDF';
      setError(text);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = (picked: File | null) => {
    if (!picked) return;
    if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (picked.size > 15 * 1024 * 1024) {
      setError('PDF is too large (max 15 MB).');
      return;
    }
    setFile(picked);
    setError(null);
    void runScan(picked);
  };

  const openCreateForm = () => {
    if (!preview) return;
    saveFinancePdfScanDraft(documentType, preview);
    reset();
    onClose();
    navigate(`${createPath}?fromScan=1`);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <div className="bg-white border border-zinc-200 rounded-none sm:rounded-xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-base font-bold text-zinc-950">
              Scan PDF → Create {label}
            </h2>
            <p className="m-0 mt-1 text-xs text-zinc-500">
              Pick a PDF from your device. AI reads the document and opens the create form with
              fields filled (number, dates, currency, addresses, products).
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 bg-white p-1 text-zinc-600 cursor-pointer disabled:opacity-50"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
          >
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 20 }} />
            {busy ? 'Scanning…' : 'Choose PDF from device'}
          </button>

          {file ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              <span className="font-semibold">File:</span> {file.name} (
              {(file.size / 1024).toFixed(0)} KB)
            </div>
          ) : null}

          {status ? <p className="m-0 text-xs text-zinc-600">{status}</p> : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          ) : null}

          {preview ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Preview (will fill create form)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-zinc-500">Number *:</span>{' '}
                  {preview.documentNumber || '—'}
                </div>
                <div>
                  <span className="text-zinc-500">Currency *:</span> {preview.currency || 'INR'}
                </div>
                <div>
                  <span className="text-zinc-500">Issue date *:</span> {preview.issueDate || '—'}
                </div>
                <div>
                  <span className="text-zinc-500">Due date *:</span> {preview.dueDate || '—'}
                </div>
                <div>
                  <span className="text-zinc-500">Exchange rate *:</span>{' '}
                  {preview.exchangeRate ?? 1}
                </div>
                <div>
                  <span className="text-zinc-500">Calculate tax *:</span>{' '}
                  {preview.taxCalculation || 'after_discount'}
                </div>
              </div>
              {preview.items?.length ? (
                <ul className="mt-3 mb-0 list-none p-0 flex flex-col gap-1.5">
                  {preview.items.slice(0, 8).map((item, idx) => (
                    <li
                      key={`${item.name}-${idx}`}
                      className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5"
                    >
                      <strong>{item.name}</strong>
                      <span className="text-zinc-500">
                        {' '}
                        · qty {item.quantity} · price {item.price} · tax {item.tax}% · amt{' '}
                        {item.amount}
                      </span>
                    </li>
                  ))}
                  {preview.items.length > 8 ? (
                    <li className="text-zinc-500">+{preview.items.length - 8} more items</li>
                  ) : null}
                </ul>
              ) : (
                <p className="mt-2 mb-0 text-amber-800">
                  No line items found — you can add products manually on the create form.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !preview}
            onClick={openCreateForm}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-3.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            <DocumentScannerOutlinedIcon sx={{ fontSize: 16 }} />
            Open create {label.toLowerCase()} form
          </button>
        </div>
      </div>
    </Dialog>
  );
};
