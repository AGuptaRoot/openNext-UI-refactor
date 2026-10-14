import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StarIcon from '@mui/icons-material/Star';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import type { SampleItem } from '../../types/samples';
import {
  sampleStatusTone,
  sampleUrgencyEmoji,
  sampleUrgencyTone,
  SAMPLE_RATING_LABELS,
} from '../../types/samples';

export interface SampleStepDef {
  id: string;
  label: string;
  description: string;
}

/** 6-stage lifecycle for Sample Requests tracked on the vertical stepper */
export const SAMPLE_REQUEST_TIMELINE_STEPS: SampleStepDef[] = [
  {
    id: 'requested',
    label: 'Sample Requested',
    description: 'Request submitted and awaiting management review',
  },
  {
    id: 'approved',
    label: 'Review & Approval',
    description: 'Approved by management / QC for fulfillment',
  },
  {
    id: 'preparing',
    label: 'Preparation & Packing',
    description: 'Stock address confirmed and sample package prepared',
  },
  {
    id: 'dispatched',
    label: 'Dispatched & In Transit',
    description: 'Handed over to courier with AWB tracking',
  },
  {
    id: 'delivered',
    label: 'Delivered',
    description: 'Sample package delivered to recipient',
  },
  {
    id: 'feedback',
    label: 'Feedback & Evaluation',
    description: 'Client evaluation, quality review & bulk order intent',
  },
];

function normalizeStatus(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function resolveSampleStepIndex(status: string, hasFeedback = false): number {
  const st = normalizeStatus(status);
  if (st === 'rejected') return 1;
  if (st === 'completed' || hasFeedback) return 5;
  if (st === 'delivered') return 4;
  if (st === 'dispatched') return 3;
  if (st === 'preparing') return 2;
  if (st === 'approved') return 1;
  return 0; // requested
}

function formatWhen(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 16);
  return parsed.toLocaleString();
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
}

const CustomStepIcon: React.FC<{
  active?: boolean;
  completed?: boolean;
  error?: boolean;
  icon: React.ReactNode;
}> = ({ active, completed, error, icon }) => {
  if (error) {
    return <ErrorOutlineIcon sx={{ color: '#dc2626', fontSize: 22 }} />;
  }
  if (completed) {
    return <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 22 }} />;
  }
  if (active) {
    return (
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          bgcolor: '#09090b',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {icon}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        bgcolor: '#f4f4f5',
        color: '#71717a',
        border: '1px solid #d4d4d8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {icon}
    </Box>
  );
};

export interface SampleRequestTimelineTrackerProps {
  sample: SampleItem;
}

export const SampleRequestTimelineTracker: React.FC<SampleRequestTimelineTrackerProps> = ({
  sample,
}) => {
  const [copied, setCopied] = useState(false);

  const isRejected = normalizeStatus(sample.status) === 'rejected';
  const hasFeedback = Boolean(
    sample.feedback && (sample.feedback.rating != null || sample.feedback.comments || sample.feedback.feedbackDate)
  );

  const isDelivered =
    !isRejected &&
    (normalizeStatus(sample.status) === 'delivered' ||
      normalizeStatus(sample.status) === 'completed' ||
      Boolean(sample.deliveredAt) ||
      hasFeedback);

  const isCompleted =
    !isRejected && (normalizeStatus(sample.status) === 'completed' || hasFeedback);

  const activeStep = resolveSampleStepIndex(sample.status, hasFeedback);

  const stepMeta = useMemo(() => {
    return {
      requested: formatWhen(sample.createdAt),
      approved: isRejected
        ? `Rejected: ${formatWhen(sample.approvedAt || sample.updatedAt)}`
        : sample.approvedAt
          ? formatWhen(sample.approvedAt)
          : activeStep >= 1
            ? 'Approved'
            : '',
      preparing: sample.stockLocation
        ? `Stock Address: ${sample.stockLocation}`
        : activeStep >= 2
          ? 'Stock Address Confirmed'
          : '',
      dispatched: sample.dispatchDate
        ? `${sample.courierName ? `${sample.courierName} · ` : ''}${formatDate(sample.dispatchDate)}`
        : activeStep >= 3
          ? 'Dispatched'
          : '',
      delivered: sample.deliveredAt
        ? formatWhen(sample.deliveredAt)
        : isDelivered
          ? formatWhen(sample.updatedAt) || 'Delivered'
          : '',
      feedback: sample.feedback?.feedbackDate
        ? formatWhen(sample.feedback.feedbackDate)
        : isCompleted
          ? 'Completed'
          : '',
    };
  }, [sample, activeStep, isRejected, isDelivered, isCompleted]);

  // Compute progress percentage
  const progressPct = useMemo(() => {
    if (isRejected) return 20;
    if (isCompleted) return 100;
    if (isDelivered) return 85;
    if (activeStep === 3) return 65; // dispatched
    if (activeStep === 2) return 45; // preparing
    if (activeStep === 1) return 30; // approved
    return 15; // requested
  }, [activeStep, isRejected, isDelivered, isCompleted]);

  const copyTracking = () => {
    if (!sample.trackingNumber) return;
    void navigator.clipboard.writeText(sample.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      data-tour="sample-detail-shipping-tracker"
      className="bg-white border border-zinc-300 rounded-xl p-5"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 m-0">Sample progress & tracking</h2>
          <p className="text-[11px] text-zinc-500 m-0 mt-1">
            Fulfillment timeline from initial request through delivery and client feedback.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            size="small"
            label={sample.status}
            className={`border font-semibold text-xs ${sampleStatusTone(sample.status)}`}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${sampleUrgencyEmoji(sample.urgency)} ${sample.urgency}`}
            className={`border font-semibold text-xs ${sampleUrgencyTone(sample.urgency)}`}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
          <Chip
            size="small"
            color={progressPct === 100 ? 'success' : progressPct >= 65 ? 'primary' : 'default'}
            label={`${progressPct}% fulfilled`}
            sx={{ fontWeight: 700, fontSize: 11 }}
          />
        </div>
      </div>

      {/* Rejection Alert Banner */}
      {isRejected && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
          <span className="font-bold">Sample Request Rejected</span>
          {sample.rejectionReason && (
            <p className="mt-1 font-normal text-rose-700 m-0">
              Reason: {sample.rejectionReason}
            </p>
          )}
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: Vertical Stepper */}
        <Box sx={{ maxWidth: 540 }}>
          <Stepper
            activeStep={
              isRejected
                ? 1
                : isCompleted
                  ? 6
                  : isDelivered
                    ? 5
                    : Math.max(0, activeStep)
            }
            orientation="vertical"
            sx={{
              '& .MuiStepIcon-root.Mui-completed': { color: '#16a34a' },
              '& .MuiStepIcon-root.Mui-active': { color: '#09090b' },
              '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
                borderColor: '#16a34a',
              },
              '& .MuiStepConnector-line': { borderColor: '#e4e4e7', minHeight: 20 },
            }}
          >
            {SAMPLE_REQUEST_TIMELINE_STEPS.map((step, index) => {
              let completed = false;
              let active = false;
              let hasError = false;

              if (isRejected) {
                if (index === 0) completed = true;
                if (index === 1) {
                  active = false;
                  hasError = true;
                }
              } else if (isCompleted) {
                completed = true;
                active = false;
              } else if (isDelivered) {
                completed = index <= 4;
                active = index === 5;
              } else {
                completed = activeStep > index;
                active = activeStep === index;
              }

              const detail = (stepMeta as Record<string, string>)[step.id];

              return (
                <Step
                  key={step.id}
                  completed={completed}
                  active={active}
                  sx={{
                    '& .MuiStepLabel-root': { cursor: 'default' },
                  }}
                >
                  <StepLabel
                    StepIconComponent={(props) => (
                      <CustomStepIcon
                        {...props}
                        completed={completed}
                        active={active}
                        error={hasError}
                      />
                    )}
                    optional={
                      detail ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color:
                              hasError
                                ? '#dc2626'
                                : (isDelivered && index === 4) || (isCompleted && index === 5)
                                  ? '#16a34a'
                                  : 'text.secondary',
                            fontWeight:
                              (isDelivered && index === 4) || (isCompleted && index === 5) || hasError
                                ? 600
                                : 400,
                          }}
                        >
                          {detail}
                        </Typography>
                      ) : null
                    }
                  >
                    <span
                      className={`text-sm font-semibold ${
                        hasError ? 'text-red-700' : 'text-zinc-950'
                      }`}
                    >
                      {step.label}
                    </span>
                  </StepLabel>

                  <StepContent
                    TransitionProps={{
                      in: active || (isDelivered && index === 4) || (isCompleted && index === 5),
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: 13 }}>
                      {step.description}
                    </Typography>

                    {/* Step 0: Requested details */}
                    {index === 0 && (
                      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5 text-xs text-zinc-700 space-y-1">
                        <div>
                          <strong>{sample.items && sample.items.length > 1 ? 'Products:' : 'Product:'}</strong>{' '}
                          {sample.productName} ({sample.quantity} {sample.unit})
                        </div>
                        {sample.items && sample.items.length > 1 && (
                          <div className="pl-2 border-l-2 border-zinc-300 text-[11px] text-zinc-600 space-y-0.5">
                            {sample.items.map((it, i) => (
                              <div key={i}>
                                • {it.productName} ({it.quantity} {it.unit})
                              </div>
                            ))}
                          </div>
                        )}
                        {sample.linkedName && (
                          <div>
                            <strong>Account:</strong> {sample.linkedName} ({sample.linkType})
                          </div>
                        )}
                        {sample.recipientName && (
                          <div>
                            <strong>Recipient:</strong> {sample.recipientName}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 1: Approval details */}
                    {index === 1 && !isRejected && sample.approvedBy && (
                      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5 text-xs text-zinc-700 space-y-1">
                        <div>
                          <strong>Approved by:</strong> {sample.approvedBy}
                        </div>
                        {sample.stockLocation && (
                          <div>
                            <strong>Stock Address:</strong> {sample.stockLocation}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 1: Rejection details */}
                    {index === 1 && isRejected && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 space-y-1">
                        <div>
                          <strong>Rejection Reason:</strong> {sample.rejectionReason || 'Not specified'}
                        </div>
                      </div>
                    )}

                    {/* Step 2: Preparing details */}
                    {index === 2 && sample.stockLocation && (
                      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5 text-xs text-zinc-700 space-y-1">
                        <div>
                          <strong>Stock Address:</strong> {sample.stockLocation}
                        </div>
                        <div className="text-zinc-500">
                          Package ready for dispatch from stock address.
                        </div>
                      </div>
                    )}

                    {/* Step 3: Dispatched & In Transit */}
                    {index === 3 && (sample.courierName || sample.trackingNumber) && (
                      <div className="rounded-lg bg-violet-50/70 border border-violet-200 p-2.5 text-xs text-violet-950 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>
                            <strong>Courier:</strong> {sample.courierName || 'Standard Express'}
                          </span>
                          {sample.estimatedDeliveryDate && (
                            <span className="text-[11px] text-violet-700">
                              ETA: {formatDate(sample.estimatedDeliveryDate)}
                            </span>
                          )}
                        </div>
                        {sample.trackingNumber && (
                          <div className="flex items-center gap-2">
                            <span>
                              <strong>AWB:</strong>{' '}
                              <code className="bg-white px-1.5 py-0.5 rounded border border-violet-200 font-mono text-violet-900">
                                {sample.trackingNumber}
                              </code>
                            </span>
                            <button
                              type="button"
                              onClick={copyTracking}
                              className="text-[11px] text-violet-600 hover:text-violet-800 underline inline-flex items-center gap-0.5"
                            >
                              <ContentCopyIcon sx={{ fontSize: 13 }} />
                              {copied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 4: Delivered details with green tick confirmation */}
                    {index === 4 && isDelivered && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-950 space-y-1">
                        <div className="flex items-center gap-1 font-semibold text-emerald-800">
                          <CheckCircleIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                          Sample successfully delivered to recipient
                        </div>
                        {sample.deliveredAt && (
                          <div className="text-[11px] text-emerald-700">
                            Delivered at: {formatWhen(sample.deliveredAt)}
                          </div>
                        )}
                        {sample.deliveryAddress && (
                          <div className="text-[11px] text-emerald-700 truncate">
                            Delivered to: {sample.deliveryAddress}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 5: Customer Feedback & Review */}
                    {index === 5 && sample.feedback && (
                      <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5 text-xs text-amber-950 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">Rating:</span>
                          <span className="inline-flex text-amber-500">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIcon
                                key={star}
                                sx={{
                                  fontSize: 16,
                                  color:
                                    (sample.feedback?.rating || 0) >= star ? '#f59e0b' : '#d4d4d8',
                                }}
                              />
                            ))}
                          </span>
                          <span className="text-[11px] font-medium text-amber-800 ml-1">
                            {sample.feedback.rating
                              ? SAMPLE_RATING_LABELS[sample.feedback.rating] || `${sample.feedback.rating}/5`
                              : 'Not rated'}
                          </span>
                        </div>
                        {sample.feedback.comments && (
                          <div className="italic text-zinc-700">
                            &ldquo;{sample.feedback.comments}&rdquo;
                          </div>
                        )}
                        {sample.feedback.interestedInOrder != null && (
                          <div className="text-[11px]">
                            <strong>Order intent:</strong>{' '}
                            {sample.feedback.interestedInOrder ? (
                              <span className="text-emerald-700 font-semibold">
                                ✓ Interested in placing bulk order
                              </span>
                            ) : (
                              <span className="text-zinc-600">Not currently interested</span>
                            )}
                          </div>
                        )}
                        {sample.feedback.requiresImprovement && (
                          <div className="text-[11px] text-amber-800">
                            <strong>Improvement routed:</strong>{' '}
                            {sample.feedback.routedDepartment || 'R&D / Technical'}
                          </div>
                        )}
                      </div>
                    )}
                  </StepContent>
                </Step>
              );
            })}
          </Stepper>
        </Box>

        {/* Right Column: Shipment Logistics & Overview Panel */}
        <div className="flex flex-col gap-4">
          {/* Progress bar card */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 mb-1.5">
              <span>Overall fulfillment progress</span>
              <span className="text-zinc-950 font-bold">{progressPct}%</span>
            </div>
            <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  isRejected
                    ? 'bg-red-500'
                    : progressPct === 100
                      ? 'bg-emerald-600'
                      : progressPct >= 65
                        ? 'bg-blue-600'
                        : 'bg-zinc-800'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Requested</span>
              <span>Approved</span>
              <span>Dispatched</span>
              <span>Delivered</span>
              <span>Review</span>
            </div>
          </div>

          {/* Courier & Shipping Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <LocalShippingIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800 m-0">
                Logistics & courier details
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-zinc-500 block uppercase">Courier Service</span>
                <span className="font-semibold text-zinc-900">
                  {sample.courierName || '— (Pending dispatch)'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 block uppercase">AWB / Tracking Number</span>
                {sample.trackingNumber ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-900 text-xs">
                      {sample.trackingNumber}
                    </code>
                    <button
                      type="button"
                      onClick={copyTracking}
                      title="Copy Tracking Number"
                      className="p-1 rounded hover:bg-zinc-100 text-zinc-500 border-0 bg-transparent cursor-pointer"
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </button>
                    {copied && <span className="text-[10px] text-emerald-600 font-semibold">Copied!</span>}
                  </div>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </div>

              <div>
                <span className="text-[11px] text-zinc-500 block uppercase">Dispatched Date</span>
                <span className="font-medium text-zinc-800">
                  {formatDate(sample.dispatchDate)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 block uppercase">Estimated Delivery</span>
                <span className="font-medium text-zinc-800">
                  {formatDate(sample.estimatedDeliveryDate)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-zinc-500 block uppercase">Stock Address</span>
                <span className="font-medium text-zinc-800 flex items-center gap-1">
                  <LocationOnIcon sx={{ fontSize: 14, color: '#71717a' }} />
                  {sample.stockLocation || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 block uppercase">Delivered On</span>
                <span className="font-semibold text-emerald-700">
                  {formatDate(sample.deliveredAt)}
                </span>
              </div>
            </div>

            {sample.deliveryAddress && (
              <div className="border-t border-zinc-100 pt-2 text-xs">
                <span className="text-[11px] text-zinc-500 block uppercase mb-0.5">Destination Address</span>
                <p className="text-zinc-800 m-0 bg-zinc-50 p-2 rounded border border-zinc-200 text-xs leading-relaxed">
                  {sample.deliveryAddress}
                </p>
              </div>
            )}
          </div>

          {/* Client Feedback Card (if submitted) */}
          {hasFeedback && sample.feedback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <StarIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-950 m-0">
                    Client review & satisfaction
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-amber-800">
                  {sample.feedback.rating ? `${sample.feedback.rating} / 5 Stars` : ''}
                </span>
              </div>

              {sample.feedback.comments && (
                <p className="text-xs text-zinc-800 m-0 bg-white p-2.5 rounded border border-amber-200 italic">
                  &ldquo;{sample.feedback.comments}&rdquo;
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                {sample.feedback.interestedInOrder != null && (
                  <div className="flex items-center gap-1">
                    <ThumbUpIcon sx={{ fontSize: 14, color: sample.feedback.interestedInOrder ? '#16a34a' : '#71717a' }} />
                    <span className="font-semibold">Order Intent:</span>
                    <span className={sample.feedback.interestedInOrder ? 'text-emerald-700 font-semibold' : 'text-zinc-600'}>
                      {sample.feedback.interestedInOrder ? 'High Interest' : 'None'}
                    </span>
                  </div>
                )}
                {sample.feedback.requiresImprovement && (
                  <div className="flex items-center gap-1 text-amber-800">
                    <BuildCircleIcon sx={{ fontSize: 14 }} />
                    <span className="font-semibold">Routed:</span>
                    <span>{sample.feedback.routedDepartment || 'R&D'}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
