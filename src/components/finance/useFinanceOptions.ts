import { useEffect, useState } from 'react';
import { crmApi } from '../../services/api';
import type { ClientOption } from '../../types/reports';
import type { LeadItem } from '../../types/leads';
import type { OpportunityItem } from '../../types/opportunities';
import type { ProjectItem } from '../../types/projects';
import type { InvoiceItem } from '../../types/invoices';

export function useFinanceOptions() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      crmApi.getClients({ limit: 200 }).catch(() => ({ success: true, data: [] as ClientOption[] })),
      crmApi.getLeads({ limit: 200 }).catch(() => ({ success: true, data: [] as LeadItem[] })),
      crmApi.listOpportunities({ limit: 200 }).catch(() => ({ success: true, data: [] as OpportunityItem[] })),
      crmApi.listProjects({ limit: 200 }).catch(() => ({ success: true, data: [] as ProjectItem[] })),
      crmApi.listInvoices({ limit: 200 }).catch(() => ({ success: true, data: [] as InvoiceItem[] })),
    ]).then(([clientResult, leadResult, opportunityResult, projectResult, invoiceResult]) => {
      if (!active) return;
      setClients(clientResult.data || []);
      setLeads(leadResult.data || []);
      setOpportunities(opportunityResult.data || []);
      setProjects(projectResult.data || []);
      setInvoices(invoiceResult.data || []);
    });
    return () => { active = false; };
  }, []);

  return { clients, leads, opportunities, projects, invoices };
}
