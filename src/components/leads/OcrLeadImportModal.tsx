import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { ApiError, crmApi } from '../../services/api';
import type { LeadOcrExtractResult } from '../../types/leads';
import { LiveCameraCapture } from '../common/LiveCameraCapture';
import { fileToVisionDataUrl } from '../../utils/imageDataUrl';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
const MAX_BYTES = 12 * 1024 * 1024;

export interface OcrLeadImportModalProps {
  open: boolean;
  onClose: () => void;
  onExtracted: (data: LeadOcrExtractResult) => void;
}

type Step = 'pick' | 'ai' | 'done' | 'error';

export const OcrLeadImportModal: React.FC<OcrLeadImportModalProps> = ({
  open,
  onClose,
  onExtracted,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    clearPreview();
    setStep('pick');
    setStatusText('');
    setError(null);
    setBusy(false);
    setLiveCameraOpen(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [clearPreview]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => () => clearPreview(), [clearPreview]);

  const onPickFile = (chosen: File | null) => {
    setError(null);
    if (!chosen) return;
    if (!chosen.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WEBP, or GIF).');
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError('Image must be 12 MB or smaller.');
      return;
    }
    clearPreview();
    const url = URL.createObjectURL(chosen);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(chosen);
    setStep('pick');
  };

  const runExtract = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);

    try {
      setStep('ai');
      setStatusText('Preparing image for Groq vision…');
      const imageDataUrl = await fileToVisionDataUrl(file);

      setStatusText('Reading visiting card with Groq AI (vision)…');
      const res = await crmApi.extractLeadFromOcr({ imageDataUrl });
      const extracted = res.data;
      if (!extracted) {
        throw new Error(res.error || 'AI extraction returned no data');
      }

      setStep('done');
      setStatusText('Fields extracted — applying to lead form…');
      onExtracted(extracted);
      onClose();
    } catch (err: unknown) {
      setStep('error');
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to extract visiting card data';
      setError(msg);
      setStatusText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'rounded-xl! border border-zinc-300 shadow-xl',
        sx: { m: 2, maxHeight: '90vh' },
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
            <PhotoCameraOutlinedIcon sx={{ fontSize: 20 }} />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold text-zinc-950">Import from visiting card</h2>
            <p className="m-0 mt-0.5 text-[11px] text-zinc-500">
              Photo → Groq vision AI → prefill lead form (no local OCR)
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          aria-label="Close"
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] || null)}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setLiveCameraOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-950 bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
          >
            <PhotoCameraOutlinedIcon sx={{ fontSize: 17 }} />
            Take photo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          >
            Choose image
          </button>
        </div>

        <div
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center ${
            busy ? 'border-zinc-200 bg-zinc-50 opacity-70' : 'border-zinc-300 bg-zinc-50'
          }`}
        >
          {previewUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={previewUrl}
                alt="Visiting card preview"
                className="max-h-48 max-w-full rounded-lg border border-zinc-200 object-contain bg-white"
              />
              <p className="m-0 text-xs font-semibold text-zinc-800 truncate max-w-full">
                {file?.name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <PhotoCameraOutlinedIcon sx={{ fontSize: 32 }} className="text-zinc-400" />
              <p className="m-0 text-xs font-semibold text-zinc-800">Visiting card photo</p>
              <p className="m-0 text-[11px] text-zinc-500">JPG, PNG, WEBP or GIF · up to 12 MB</p>
            </div>
          )}
        </div>

        {step === 'ai' && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              <span>{statusText || 'Working…'}</span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {step === 'done' && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800">
            <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
            Applied to lead form
          </div>
        )}

        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
          Groq vision reads the photo directly (no Tesseract). Optionally guesses salutation, gender,
          lead type, and request type when confident.
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="h-[34px] rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => void runExtract()}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
        >
          <AutoAwesomeIcon sx={{ fontSize: 15 }} />
          {busy ? 'Analysing…' : 'Scan & fill form'}
        </button>
      </div>
    </Dialog>

    <LiveCameraCapture
      open={liveCameraOpen}
      onClose={() => setLiveCameraOpen(false)}
      onCapture={(captured) => onPickFile(captured)}
      title="Photograph visiting card"
      hint="Allow camera access, frame the card clearly, then tap Capture."
    />
    </>
  );
};
