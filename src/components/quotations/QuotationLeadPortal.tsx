import React, { useEffect, useState } from 'react';

import { notify } from '@/components/notifications';
import { crmApi } from '../../services/api';
import { LeadPortalAccessButton } from '../leads/LeadPortalAccess';

/**
 * CRM 3.56.0: on a quotation sent to a lead, "Create portal" gives the lead a portal login (OpenNext user
 * with the "Client / Customer Portal" role, details emailed with the login link) so they can review and
 * accept it. Same dialog and approval rules as the lead page. Hidden once the lead is a client (the
 * client's portal access lives on the client page).
 */
export const QuotationLeadPortal: React.FC<{ leadId: string; canWrite: boolean }> = ({ leadId, canWrite }) => {
  const [lead, setLead] = useState<{ email: string; name: string; converted: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    setLead(null);
    if (!leadId) return undefined;
    crmApi
      .getLead(leadId)
      .then((res) => {
        if (!alive) return;
        const row = res.data;
        setLead({
          email: String(row?.email || ''),
          name: String(row?.company || row?.name || ''),
          converted: Boolean(row?.convertedClientId),
        });
      })
      .catch(() => alive && setLead(null));
    return () => {
      alive = false;
    };
  }, [leadId]);

  if (!lead || lead.converted || !canWrite) return null;
  return (
    <LeadPortalAccessButton
      leadId={leadId}
      leadEmail={lead.email}
      leadName={lead.name}
      canWrite={canWrite}
      showToast={(message, tone) => notify.show(tone === 'error' ? 'error' : 'success', message)}
    />
  );
};

export default QuotationLeadPortal;
