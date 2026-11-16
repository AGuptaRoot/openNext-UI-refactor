import React, { useCallback, useEffect, useState } from 'react';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ApiError, crmApi } from '../../services/api';

interface PrivateStorageStatus {
  mode: 's3' | 'none' | 'server';
  source: 'env' | 's3_media_plugin' | null;
  bucket: string;
  region?: string;
  prefix: string;
}

const SOURCE_LABEL: Record<string, string> = {
  env: 'server environment settings',
  s3_media_plugin: 'the S3 Media Storage plugin',
};

/** Settings → Integrations: where passport / Aadhaar images and other private documents are stored. */
export const PrivateStoragePanel: React.FC = () => {
  const [status, setStatus] = useState<PrivateStorageStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.getPrivateStorageStatus();
      setStatus(res.data as PrivateStorageStatus);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Storage status could not be loaded');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onS3 = status?.mode === 's3';
  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-5" data-testid="private-storage-panel">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700" aria-hidden="true">
            <CloudOutlinedIcon sx={{ fontSize: 18 }} />
          </span>
          <div>
            <h2 className="m-0 text-sm font-semibold text-zinc-950">Private document storage</h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500">
              Passport and Aadhaar images, tickets, vouchers and other private files. Every file is encrypted before it is stored.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
        >
          <RefreshIcon sx={{ fontSize: 14 }} /> Check
        </button>
      </div>
      {loading ? (
        <p className="m-0 text-xs text-zinc-500">Checking…</p>
      ) : error ? (
        <p className="m-0 text-xs font-semibold text-red-700" role="alert">{error}</p>
      ) : status ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px]">
          <p className="m-0">
            <span
              className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                onS3 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {onS3 ? 'Amazon S3' : 'Server folder'}
            </span>
            {onS3 ? (
              <>
                New files go to <strong>{status.bucket}</strong>
                {status.region ? ` (${status.region})` : ''}, folder <code>{status.prefix}/</code>, using{' '}
                {SOURCE_LABEL[status.source || ''] || 'S3 settings'}.
              </>
            ) : (
              <>Uploads are disabled until the S3 Media plugin is configured and enabled: files are stored only on S3, never on this server.</>
            )}
          </p>
          {!onS3 ? (
            <p className="m-0 mt-1.5 text-xs text-zinc-600">
              To store them in Amazon S3, configure the <strong>S3 Media Storage</strong> plugin (Dashboard → Settings → AWS S3
              Media Storage) and click Check. Files already saved stay where they are and still open.
            </p>
          ) : (
            <p className="m-0 mt-1.5 text-xs text-zinc-600">Files saved earlier on the server still open (read only); nothing new is stored there.</p>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default PrivateStoragePanel;
