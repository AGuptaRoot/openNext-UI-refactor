import React, { useState } from 'react';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { FileUploadField } from './FileUploadField';
import { crmApi } from '../../services/api';

export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md,.rtf,.zip,image/*,application/pdf';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

export type DocumentUploadFolder =
  | 'clients'
  | 'contacts'
  | 'leads'
  | 'projects'
  | 'expenses'
  | 'tickets'
  | 'invoices'
  | 'payments'
  | 'quotations'
  | 'general';

export interface DocumentUploadResult {
  url: string;
  fileUrl: string;
  fileName: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
  provider?: string;
  storageKey?: string;
}

export interface DocumentUploadControlProps {
  /** Storage folder / entity type sent to POST /media/upload */
  folder?: DocumentUploadFolder;
  entityId?: string;
  accept?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  /**
   * auto — upload as soon as a file is chosen (simple attachment fields)
   * button — choose file first, then click Upload document
   */
  mode?: 'auto' | 'button';
  buttonLabel?: string;
  uploadButtonLabel?: string;
  hint?: string;
  /** Shown after a successful upload */
  currentFileName?: string | null;
  currentUrl?: string | null;
  /** Custom uploader (entity document routes). Defaults to crmApi.uploadMedia. */
  uploadFn?: (file: File) => Promise<DocumentUploadResult>;
  onUploaded: (result: DocumentUploadResult) => void | Promise<void>;
  onError?: (message: string) => void;
}

function normalizeUploadError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || 'Upload failed';
    if (/plugin route not found/i.test(msg)) {
      return 'Upload API is not available. Reload the CRM plugin and try again.';
    }
    return msg;
  }
  return 'Upload failed';
}

/**
 * Reusable document/media uploader for CRM modules.
 * Uses POST /media/upload by default, or a custom uploadFn for entity-bound docs.
 */
export const DocumentUploadControl: React.FC<DocumentUploadControlProps> = ({
  folder = 'general',
  entityId,
  accept = DOCUMENT_ACCEPT,
  disabled = false,
  compact = false,
  className = '',
  mode = 'auto',
  buttonLabel = 'Choose file',
  uploadButtonLabel = 'Upload document',
  hint,
  currentFileName,
  currentUrl,
  uploadFn,
  onUploaded,
  onError,
}) => {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(currentFileName ?? null);

  const runUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      let result: DocumentUploadResult;
      if (uploadFn) {
        result = await uploadFn(file);
      } else {
        const res = await crmApi.uploadMedia(file, { folder, entityId });
        const url = res.data?.url || res.data?.fileUrl || '';
        if (!url) throw new Error('Upload succeeded but no file URL was returned');
        result = {
          url,
          fileUrl: res.data.fileUrl || url,
          fileName: res.data.fileName || file.name,
          originalName: res.data.originalName || file.name,
          mimeType: res.data.mimeType || file.type,
          fileSize: res.data.fileSize || file.size,
          provider: res.data.provider,
          storageKey: res.data.storageKey,
        };
      }
      setLastName(result.fileName || file.name);
      setPendingFile(null);
      await onUploaded(result);
    } catch (err) {
      const message = normalizeUploadError(err);
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <FileUploadField
        accept={accept}
        disabled={disabled || uploading}
        compact={compact}
        buttonLabel={uploading ? 'Uploading…' : buttonLabel}
        hint={
          hint ||
          (mode === 'button'
            ? 'Select a file, then click Upload document'
            : 'File uploads as soon as you choose it')
        }
        fileName={pendingFile?.name ?? lastName ?? null}
        clearAfterChange={mode === 'auto'}
        onFileChange={async (file) => {
          if (!file) {
            setPendingFile(null);
            return;
          }
          if (mode === 'button') {
            setPendingFile(file);
            setError(null);
            return;
          }
          setPendingFile(file);
          await runUpload(file);
        }}
      />

      {mode === 'button' ? (
        <button
          type="button"
          disabled={disabled || uploading || !pendingFile}
          onClick={() => {
            if (pendingFile) void runUpload(pendingFile);
          }}
          className={`inline-flex w-fit items-center gap-1.5 rounded-lg border-none bg-zinc-950 px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            compact ? 'h-8 text-[11px]' : 'h-9 text-xs'
          }`}
        >
          <UploadFileOutlinedIcon sx={{ fontSize: compact ? 14 : 15 }} />
          {uploading ? 'Uploading…' : uploadButtonLabel}
        </button>
      ) : null}

      {error ? <p className="m-0 text-[11px] font-medium text-red-600">{error}</p> : null}
      {!error && (lastName || currentUrl) ? (
        <p className="m-0 text-[11px] font-medium text-emerald-700">
          {lastName ? `${lastName} ready` : 'File uploaded'}
        </p>
      ) : null}
    </div>
  );
};
