import React, { useState, useRef } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CheckCircle2, Eye, Upload } from 'lucide-react';

import { triggerFileDownload } from '../../utils/fileDownload';

export interface ExportResult {
  title?: string;
  filename: string;
  format: string;
  content: string;
  directUrl?: string;
  recordCount?: number;
}

interface ExportResultModalProps {
  open: boolean;
  result: ExportResult | null;
  onClose: () => void;
}

export const ExportResultModal: React.FC<ExportResultModalProps> = ({
  open,
  result,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!open || !result) return null;

  const {
    title = `Export Leads (${result.format.toUpperCase()})`,
    filename,
    format,
    content,
    directUrl,
  } = result;

  const lines = content ? content.split('\n').filter((l) => l.trim().length > 0) : [];
  const count =
    result.recordCount !== undefined
      ? result.recordCount
      : format.toLowerCase() === 'csv'
      ? Math.max(0, lines.length - 1)
      : lines.length;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }
  };

  const handleManualDownload = () => {
    triggerFileDownload({
      filename,
      content,
      format,
      directUrl,
    });
  };

  const handleSelectAll = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-zinc-300 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-none animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <Upload className="h-[18px] w-[18px] shrink-0 text-zinc-700" aria-hidden />
            <div>
              <h3 className="text-base font-bold text-zinc-950 m-0">{title}</h3>
              <p className="text-xs text-zinc-500 m-0 mt-0.5 font-mono">
                {filename} ({format.toUpperCase()} • {count > 0 ? `${count} records` : 'Ready'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer transition-colors"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Success Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
            <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-700 mt-0.5" aria-hidden />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong>Data exported successfully!</strong>
              <p className="m-0 mt-0.5 text-emerald-800">
                An automatic browser download was initiated. If your browser or iframe security sandbox blocked the automatic download, click the manual download or copy buttons below.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleManualDownload}
              className="px-4 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs border border-zinc-950 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
              <span>Download {format.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-lg font-semibold text-xs border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                copied
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-200'
              }`}
            >
              {copied ? (
                <>
                  <CheckIcon sx={{ fontSize: 16 }} className="text-emerald-700" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          </div>

          {/* Direct URL link if provided */}
          {directUrl && (
            <div className="text-center">
              <a
                href={directUrl}
                download={filename}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-950 hover:underline font-medium"
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
                <span>Open direct download link in new tab</span>
              </a>
            </div>
          )}

          {/* Collapsible Preview & Raw Content */}
          <details className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-zinc-800 flex items-center justify-between select-none">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                View / Select Raw Data
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">Click to expand</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                readOnly
                value={content}
                rows={7}
                className="w-full text-[11px] font-mono p-2.5 bg-white border border-zinc-200 rounded-md text-zinc-800 outline-none resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-[11px] font-medium border border-zinc-200 rounded bg-white hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                >
                  Select All Text
                </button>
              </div>
            </div>
          </details>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-200 flex justify-end bg-zinc-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
