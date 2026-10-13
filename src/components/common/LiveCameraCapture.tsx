import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import CameraswitchOutlinedIcon from '@mui/icons-material/CameraswitchOutlined';
import FlipCameraAndroidOutlinedIcon from '@mui/icons-material/FlipCameraAndroidOutlined';

export interface LiveCameraCaptureProps {
  open: boolean;
  onClose: () => void;
  /** Called with a JPEG File from the live camera snapshot. */
  onCapture: (file: File) => void;
  title?: string;
  hint?: string;
}

type FacingMode = 'environment' | 'user';

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

/**
 * Live camera (getUserMedia) — opens the device camera with permission,
 * works on phone and laptop. Prefer this over <input capture> which often
 * falls back to the gallery / file picker.
 */
export const LiveCameraCapture: React.FC<LiveCameraCaptureProps> = ({
  open,
  onClose,
  onCapture,
  title = 'Take photo',
  hint = 'Allow camera access, then frame the visiting card and tap Capture.',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<FacingMode>('environment');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const startCamera = useCallback(async (mode: FacingMode) => {
    setStarting(true);
    setError(null);
    setReady(false);
    stopStream(streamRef.current);
    streamRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Camera API is not available in this browser. Use HTTPS (or localhost) and a modern browser, or Choose image instead.'
      );
      setStarting(false);
      return;
    }

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        // Fallback without facingMode (some desktops reject environment)
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setReady(true);
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError(
          'Camera permission was denied. Allow camera access in the browser/site settings, then try again.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera was found on this device.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('Camera is in use by another app. Close it and try again.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not open the camera. Try again or use Choose image.'
        );
      }
      setReady(false);
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setReady(false);
      setError(null);
      setCapturing(false);
      return;
    }
    void startCamera(facing);
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    // Only restart when dialog opens or facing changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  const handleClose = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    onClose();
  };

  const flipCamera = () => {
    setFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;
    setCapturing(true);
    try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      if (!width || !height) {
        throw new Error('Camera preview is not ready yet. Wait a moment and try again.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture frame');
      ctx.drawImage(video, 0, 0, width, height);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create photo'))),
          'image/jpeg',
          0.92
        );
      });

      const file = new File([blob], `visiting-card-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      stopStream(streamRef.current);
      streamRef.current = null;
      onCapture(file);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to capture photo');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!capturing) handleClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'rounded-xl! border border-zinc-300 shadow-xl',
        sx: { m: 2, maxHeight: '92vh' },
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
            <PhotoCameraOutlinedIcon sx={{ fontSize: 20 }} />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold text-zinc-950">{title}</h2>
            <p className="m-0 mt-0.5 text-[11px] text-zinc-500">{hint}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={capturing}
          onClick={handleClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          aria-label="Close"
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="relative overflow-hidden rounded-xl border border-zinc-300 bg-zinc-950 aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          {(starting || !ready) && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 text-xs font-semibold text-white">
              {starting ? 'Starting camera…' : 'Waiting for camera…'}
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        <p className="m-0 text-[11px] text-zinc-500">
          Your browser will ask for camera permission. On phones, the rear camera is preferred; use
          Flip to switch.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-5 py-3">
        <button
          type="button"
          disabled={starting || capturing}
          onClick={flipCamera}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          title="Switch camera"
        >
          <FlipCameraAndroidOutlinedIcon sx={{ fontSize: 16 }} />
          Flip
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={capturing}
            onClick={handleClose}
            className="h-[34px] rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || capturing || Boolean(error)}
            onClick={() => void capturePhoto()}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
          >
            <CameraswitchOutlinedIcon sx={{ fontSize: 16 }} className="hidden" />
            <PhotoCameraOutlinedIcon sx={{ fontSize: 16 }} />
            {capturing ? 'Capturing…' : 'Capture'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
