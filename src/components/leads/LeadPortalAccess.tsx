import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

import { crmApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ClientPortalAccess } from '../../types/clients';

interface LeadPortalAccessButtonProps {
  leadId: string;
  /** Pre-fills the invite form; the rep can still change it. */
  leadEmail?: string;
  leadName?: string;
  canWrite: boolean;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  /** When true (e.g. on lead-related opportunities), hides the button if portal access is already granted / active. */
  hideIfPortalActive?: boolean;
}

/** Random, readable starting password so nobody invents "123456". */
function suggestPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let index = 0; index < 10; index += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * "Get portal" for a lead whose deal has reached Requirement Confirmed.
 *
 * Reps submit requests for Manager approval.
 * Managers / Admins can directly invite or approve pending requests.
 */
export const LeadPortalAccessButton: React.FC<LeadPortalAccessButtonProps> = ({
  leadId,
  leadEmail,
  leadName,
  canWrite,
  showToast,
  hideIfPortalActive = false,
}) => {
  const { isAdmin, activeRole, hasPermission } = useAuth();
  const canApprove =
    isAdmin ||
    activeRole === 'crm-manager' ||
    activeRole === 'sales-manager' ||
    hasPermission('crm.users.manage');

  const [access, setAccess] = useState<ClientPortalAccess[]>([]);
  const [blockedReason, setBlockedReason] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState(leadEmail || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await crmApi.getLeadPortalAccess(leadId);
      setAccess(res.data?.access || []);
      setBlockedReason(res.data?.blockedReason || '');
    } catch {
      // Portal access is an extra; a failure here must not break the page.
    } finally {
      setLoaded(true);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const existing = access.find((row) => row.status !== 'Revoked');

  if (!loaded || !canWrite) return null;
  // If hiding on active portal records (e.g. opportunities of a portal lead), omit button once portal is active
  if (hideIfPortalActive && existing && (existing.status === 'Active' || existing.status === 'Invited')) {
    return null;
  }
  // No deal at Requirement Confirmed yet and nothing issued — nothing to show.
  if (blockedReason && !existing) return null;

  const openForm = () => {
    const seedEmail = existing?.email || leadEmail || '';
    setEmail(seedEmail);
    setUsername(existing?.username || seedEmail.split('@')[0] || '');
    setPassword(suggestPassword());
    setPhone(existing?.phone || '');
    setFormError('');
    setSentTo('');
    setRejecting(false);
    setRejectionReason('');
    setOpen(true);
  };

  const revoke = async () => {
    if (!existing) return;
    setSaving(true);
    setFormError('');
    try {
      await crmApi.revokeLeadPortalAccess(leadId, existing._id);
      showToast(`Portal access for ${existing.email} was withdrawn`);
      setOpen(false);
      await load();
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'Could not withdraw portal access');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!existing) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await crmApi.approveLeadPortalAccess(leadId, existing._id);
      const emailed = res.data?.emailSent !== false;
      showToast(
        emailed
          ? `Portal access approved & login credentials emailed to ${existing.email}`
          : `Portal access approved & user created, but email could not be sent.`,
        emailed ? 'success' : 'error'
      );
      await load();
      setOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to approve portal access');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!existing) return;
    if (!rejectionReason.trim()) {
      setFormError('Please enter a rejection reason.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await crmApi.rejectLeadPortalAccess(leadId, existing._id, {
        reason: rejectionReason.trim(),
      });
      showToast(`Portal access request rejected`);
      await load();
      setOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to reject portal access');
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async () => {
    if (!existing) return;
    setFormError('');
    if (!username.trim() || username.trim().length < 3) {
      return setFormError('Username must be at least 3 characters.');
    }
    if (!password.trim() || password.trim().length < 6) {
      return setFormError('Password must be at least 6 characters.');
    }

    setSaving(true);
    try {
      await crmApi.resubmitLeadPortalAccess(leadId, existing._id, {
        username: username.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
      });
      showToast('Portal access request resubmitted for manager approval');
      await load();
      setOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to resubmit request');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setFormError('');
    if (!email.trim()) return setFormError('Email is required.');
    if (username.trim().length < 3) return setFormError('Username must be at least 3 characters.');
    if (password.trim().length < 6) return setFormError('Password must be at least 6 characters.');

    setSaving(true);
    try {
      const res = await crmApi.inviteLeadPortalAccess(leadId, {
        email: email.trim(),
        username: username.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
      });
      const emailed = res.data?.emailSent !== false;
      const isPending = res.data?.status === 'Pending_Approval';

      if (isPending) {
        showToast('Portal access request submitted for manager approval', 'success');
      } else {
        showToast(
          emailed
            ? `Portal access emailed to ${email.trim()}`
            : `Portal access created, but email could not be sent.`,
          emailed ? 'success' : 'error'
        );
      }
      setSentTo(email.trim());
      await load();
      setOpen(false);
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'Could not create portal access');
    } finally {
      setSaving(false);
    }
  };

  const isPending = existing?.status === 'Pending_Approval';
  const isRejected = existing?.status === 'Rejected';
  const isActive = existing?.status === 'Active' || existing?.status === 'Invited';

  let buttonClass = 'border-0 bg-blue-600 text-white shadow-sm hover:bg-blue-700';
  let buttonIcon = <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  let buttonLabel = canApprove ? 'Create portal' : 'Request portal';

  if (isPending) {
    buttonClass = 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100';
    buttonIcon = <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />;
    buttonLabel = 'Portal Pending Approval';
  } else if (isRejected) {
    buttonClass = 'border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100';
    buttonIcon = <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />;
    buttonLabel = 'Portal Request Rejected';
  } else if (isActive) {
    buttonClass = 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';
    buttonIcon = <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />;
    buttonLabel = 'Portal access active';
  }

  return (
    <>
      <button
        type="button"
        onClick={openForm}
        data-tour="leads-portal-access"
        title={buttonLabel}
        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold cursor-pointer ${buttonClass}`}
      >
        {buttonIcon}
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="m-0 text-base font-bold text-zinc-950">
                {isPending
                  ? 'Client Portal Request — Pending Approval'
                  : isRejected
                  ? 'Client Portal Request — Rejected'
                  : canApprove
                  ? 'Client Portal Access'
                  : 'Request Client Portal Access'}
                {leadName ? ` — ${leadName}` : ''}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {isPending ? (
              <div className="mt-3 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>Awaiting Manager / Admin Approval</span>
                </div>
                <p className="mt-1 mb-0 text-[11px] text-amber-800">
                  Requested by <strong className="font-semibold">{existing?.requestedByName || existing?.requestedBy || 'Sales Rep'}</strong> for <strong className="font-semibold">{existing?.email}</strong> (Username: <code>{existing?.username}</code>).
                  Upon approval, an OpenNext CMS user account will be created and login details will be dispatched to the client.
                </p>
              </div>
            ) : isRejected ? (
              <div className="mt-3 mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Request Rejected by Manager</span>
                </div>
                <p className="mt-1 mb-0 text-[11px] text-rose-800">
                  <strong>Reason:</strong> {existing?.rejectionReason || 'No specific reason provided.'}
                </p>
                <p className="mt-1 mb-0 text-[11px] text-zinc-500">
                  You can update the credentials below and resubmit for approval.
                </p>
              </div>
            ) : (
              <p className="mt-2 mb-4 text-xs text-zinc-500">
                {canApprove
                  ? 'Credentials will be emailed directly to the client with the portal login link. This does not convert the lead or change its stage.'
                  : 'Submit client username & password to Sales Manager for approval. Upon approval, credentials and login link will be emailed.'}
              </p>
            )}

            {/* Rejection input box when manager clicks Reject */}
            {rejecting && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-red-800">
                    Rejection Reason (Mandatory)
                  </span>
                  <textarea
                    rows={2}
                    className="rounded-lg border border-red-300 p-2 text-xs"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide reason for rejecting this portal access request..."
                  />
                </label>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(false)}
                    className="h-7 px-2.5 text-xs rounded border border-zinc-300 bg-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleReject}
                    className="h-7 px-2.5 text-xs font-semibold rounded bg-red-600 text-white border-0 cursor-pointer hover:bg-red-700"
                  >
                    {saving ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            )}

            {!rejecting && (
              <>
                <label className="mb-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Email</span>
                  <input
                    type="email"
                    disabled={Boolean(existing && !isRejected)}
                    className="h-9 rounded-lg border border-zinc-300 px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-600"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@company.com"
                  />
                </label>

                <label className="mb-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Username</span>
                  <input
                    disabled={Boolean(isPending)}
                    className="h-9 rounded-lg border border-zinc-300 px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-600"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>

                <label className="mb-1 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Password</span>
                  <div className="flex gap-2">
                    <input
                      disabled={Boolean(isPending)}
                      className="h-9 flex-1 rounded-lg border border-zinc-300 px-3 text-sm font-mono disabled:bg-zinc-100 disabled:text-zinc-600"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    {!isPending && (
                      <button
                        type="button"
                        onClick={() => setPassword(suggestPassword())}
                        className="h-9 shrink-0 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer hover:bg-zinc-50"
                      >
                        Generate
                      </button>
                    )}
                  </div>
                </label>

                <label className="mt-3 mb-3 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase text-zinc-500">Phone (Optional)</span>
                  <input
                    disabled={Boolean(isPending)}
                    className="h-9 rounded-lg border border-zinc-300 px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-600"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </label>
              </>
            )}

            {formError ? (
              <p className="m-0 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {formError}
              </p>
            ) : null}
            {sentTo ? (
              <p className="m-0 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Sent to {sentTo}.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3">
              {isActive && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void revoke()}
                  className="mr-auto h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 cursor-pointer disabled:opacity-50 hover:bg-red-100"
                  title="Withdraw access and close deals to the portal"
                >
                  Revoke access
                </button>
              )}

              {isPending && canApprove && !rejecting && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setRejecting(true)}
                    className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 cursor-pointer hover:bg-red-100"
                  >
                    <XCircle className="h-3.5 w-3.5 inline mr-1" />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleApprove}
                    className="h-9 rounded-lg border-0 bg-emerald-600 px-3 text-xs font-semibold text-white cursor-pointer hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                    {saving ? 'Approving…' : 'Approve & Create User'}
                  </button>
                </>
              )}

              {isRejected && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleResubmit}
                  className="h-9 rounded-lg border-0 bg-blue-600 px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 hover:bg-blue-700"
                >
                  {saving ? 'Resubmitting…' : 'Resubmit Request'}
                </button>
              )}

              {!isPending && !isRejected && !isActive && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="h-9 rounded-lg border-0 bg-blue-600 px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 hover:bg-blue-700"
                >
                  {saving
                    ? 'Submitting…'
                    : canApprove
                    ? 'Send portal access'
                    : 'Submit for Manager Approval'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
