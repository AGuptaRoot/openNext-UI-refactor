import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SentimentSatisfiedAltOutlinedIcon from '@mui/icons-material/SentimentSatisfiedAltOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/api';
import { canFullyManageTasks } from '../../utils/permissions';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  category:
    | 'Modules'
    | 'Actions'
    | 'Leads'
    | 'Clients'
    | 'Projects'
    | 'Tasks'
    | 'Invoices'
    | 'Tickets'
    | 'Opportunities';
  path: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
}

interface ModuleDefinition {
  id: string;
  title: string;
  path: string;
  description: string;
  keywords: string[];
  icon: React.ReactNode;
  permission?: string;
  /** If set, user needs any one of these permissions (takes precedence over `permission`). */
  anyOf?: string[];
  allowClient?: boolean;
}

interface ActionDefinition {
  id: string;
  title: string;
  path: string;
  description: string;
  keywords: string[];
  permission?: string;
  /** If set, user needs any one of these permissions (takes precedence over `permission`). */
  anyOf?: string[];
  allowClient?: boolean;
}

const ALL_MODULES: ModuleDefinition[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/dashboard',
    description: 'KPI overview, pipeline metrics, activity feeds',
    keywords: ['home', 'kpi', 'metrics', 'overview', 'stats', 'analytics'],
    icon: <DashboardOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.dashboard.view',
    allowClient: false,
  },
  {
    id: 'leads',
    title: 'Leads & Inquiries',
    path: '/leads',
    description: 'Prospective clients, lead capture & pipeline conversion',
    keywords: ['prospects', 'sales leads', 'conversion', 'pipeline'],
    icon: <TrackChangesIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.leads.read',
    allowClient: false,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    path: '/contacts',
    description: 'People directory — emails, phones & linked leads/clients',
    keywords: ['people', 'persons', 'phonebook', 'directory', 'contact persons'],
    icon: <ContactsOutlinedIcon sx={{ fontSize: 18 }} />,
    anyOf: ['crm.contacts.read', 'crm.leads.read'],
    allowClient: false,
  },
  {
    id: 'clients',
    title: 'Clients & Companies',
    path: '/clients',
    description: 'Accounts, client companies & point-of-contacts',
    keywords: ['customers', 'accounts', 'companies', 'organizations', 'directory'],
    icon: <BusinessOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.clients.read',
    allowClient: false,
  },
  {
    id: 'opportunities',
    title: 'Deals & Opportunities',
    path: '/opportunities',
    description: 'Sales pipeline stages, deal probabilities & forecast',
    keywords: ['deals', 'pipeline', 'sales stages', 'revenue forecast', 'bids'],
    icon: <TrendingUpIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.opportunities.read',
    allowClient: false,
  },
  {
    id: 'projects',
    title: 'Projects & Milestones',
    path: '/projects',
    description: 'Deliverables, milestones, timeline & project tracking',
    keywords: ['project tracking', 'deliverables', 'milestones', 'status', 'gantt'],
    icon: <FolderOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.projects.read',
    allowClient: true,
  },
  {
    id: 'tasks',
    title: 'Tasks & Subtasks',
    path: '/tasks',
    description: 'Work items, kanban board, priorities & dependencies',
    keywords: ['todo', 'kanban', 'work items', 'subtasks', 'assignments'],
    icon: <ChecklistOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.tasks.read',
    allowClient: true,
  },
  {
    id: 'time-logs',
    title: 'Time Logs & Timesheets',
    path: '/time-logs',
    description: 'Billable hours, work sessions & check-in timers',
    keywords: ['hours', 'timesheet', 'timer', 'billable time', 'work duration'],
    icon: <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.time.read',
    allowClient: false,
  },
  {
    id: 'quotations',
    title: 'Quotations & Estimates',
    path: '/quotations',
    description: 'Sales quotes, cost proposals & estimate templates',
    keywords: ['quotes', 'estimates', 'proposals', 'pricing', 'discount'],
    icon: <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.finance.read',
    allowClient: false,
  },
  {
    id: 'invoices',
    title: 'Invoices & Billing',
    path: '/invoices',
    description: 'Customer invoices, tax breakdowns, recurring billing',
    keywords: ['bills', 'tax invoice', 'billing', 'statements', 'receipts'],
    icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.finance.read',
    allowClient: true,
  },
  {
    id: 'sales-orders',
    title: 'Sales Orders',
    path: '/sales-orders',
    description: 'Customer confirmed purchase orders & fulfillment',
    keywords: ['orders', 'fulfillment', 'purchase order', 'sales'],
    icon: <ShoppingBagOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.orders.read',
    allowClient: true,
  },
  {
    id: 'payments',
    title: 'Payments & Receipts',
    path: '/payments',
    description: 'Recorded payments, payment gateways & settlement status',
    keywords: ['transactions', 'razorpay', 'receipts', 'settlements', 'collections'],
    icon: <CreditCardOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.finance.read',
    allowClient: false,
  },
  {
    id: 'expenses',
    title: 'Expenses & Vouchers',
    path: '/expenses',
    description: 'Operational expenses, reimbursements & billable costs',
    keywords: ['costs', 'receipts', 'expenditure', 'vouchers', 'claims'],
    icon: <AttachMoneyOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.expenses.read',
    allowClient: false,
  },
  {
    id: 'tickets',
    title: 'Support Tickets',
    path: '/tickets',
    description: 'Client support requests, issue resolution & SLA',
    keywords: ['support', 'issues', 'helpdesk', 'bugs', 'sla', 'cases'],
    icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.tickets.read',
    allowClient: true,
  },
  {
    id: 'samples',
    title: 'Sample Requests',
    path: '/samples',
    description: 'Product sample prototypes, approval workflows',
    keywords: ['product samples', 'prototypes', 'trials', 'testing', 'specimens'],
    icon: <ScienceOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.samples.read',
    allowClient: false,
  },
  {
    id: 'customer-success',
    title: 'Customer Success',
    path: '/customer-success',
    description: 'Health scores, churn warnings & client satisfaction',
    keywords: ['retention', 'health score', 'csat', 'churn risk', 'satisfaction'],
    icon: <SentimentSatisfiedAltOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.customerSuccess.read',
    allowClient: false,
  },
  {
    id: 'marketing',
    title: 'Marketing & Campaigns',
    path: '/marketing',
    description: 'Campaign tracking, re-engagement emails & outreach',
    keywords: ['campaigns', 'outreach', 'email marketing', 're-engagement'],
    icon: <CampaignOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.marketing.read',
    allowClient: false,
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    path: '/reports',
    description: 'Performance breakdowns, pipeline velocity & financial export',
    keywords: ['analytics', 'charts', 'revenue report', 'exports', 'summary'],
    icon: <BarChartOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.reports.read',
    allowClient: false,
  },
  {
    id: 'data-quality',
    title: 'Data Quality Center',
    path: '/data-quality',
    description: 'Duplicate detection, contact enrichment & audit',
    keywords: ['duplicates', 'clean data', 'validation', 'integrity', 'deduplication'],
    icon: <SecurityOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.dataQuality.read',
    allowClient: false,
  },
  {
    id: 'audit',
    title: 'Audit Logs & Timeline',
    path: '/audit',
    description: 'Comprehensive historical audit trail of system events',
    keywords: ['audit trail', 'history', 'change logs', 'security events', 'timeline'],
    icon: <HistoryOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.audit.read',
    allowClient: false,
  },
  {
    id: 'settings',
    title: 'Settings & Workspace',
    path: '/settings',
    description: 'Company settings, currencies, permissions & users',
    keywords: ['preferences', 'config', 'roles', 'users', 'company', 'admin'],
    icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
    permission: 'crm.settings.manage',
    allowClient: false,
  },
];

const ALL_ACTIONS: ActionDefinition[] = [
  {
    id: 'new-lead',
    title: '+ Create New Lead',
    path: '/leads/create',
    description: 'Capture a new prospective sales lead',
    keywords: ['add lead', 'new lead', 'create lead'],
    permission: 'crm.leads.write',
    allowClient: false,
  },
  {
    id: 'new-contact',
    title: '+ Create New Contact',
    path: '/contacts/create',
    description: 'Add a person to the contacts directory',
    keywords: ['add contact', 'new contact', 'create person'],
    anyOf: ['crm.contacts.write', 'crm.leads.write'],
    allowClient: false,
  },
  {
    id: 'new-client',
    title: '+ Add New Client Company',
    path: '/clients/create',
    description: 'Register a new customer organization',
    keywords: ['add client', 'new client', 'create company'],
    permission: 'crm.clients.write',
    allowClient: false,
  },
  {
    id: 'new-project',
    title: '+ Create New Project',
    path: '/projects/create',
    description: 'Initialize a client project workspace',
    keywords: ['add project', 'new project', 'start project'],
    permission: 'crm.projects.write',
    allowClient: false,
  },
  {
    id: 'new-task',
    title: '+ Create New Task',
    path: '/tasks/create',
    description: 'Add a new task deliverable with priority and deadline',
    keywords: ['add task', 'new task', 'create todo'],
    permission: 'crm.tasks.write',
    allowClient: false,
  },
  {
    id: 'new-opportunity',
    title: '+ Create Sales Deal',
    path: '/opportunities/create',
    description: 'Add a potential deal to the sales pipeline',
    keywords: ['add deal', 'new opportunity', 'create deal'],
    permission: 'crm.opportunities.write',
    allowClient: false,
  },
  {
    id: 'new-quotation',
    title: '+ Generate Quotation',
    path: '/quotations/create',
    description: 'Draft a price quotation or estimate',
    keywords: ['add quote', 'new quotation', 'generate estimate'],
    anyOf: ['crm.quotes.write', 'crm.finance.write'],
    allowClient: false,
  },
  {
    id: 'new-invoice',
    title: '+ Issue Invoice',
    path: '/invoices/create',
    description: 'Create a billing statement or tax invoice',
    keywords: ['add invoice', 'new invoice', 'bill client'],
    permission: 'crm.finance.write',
    allowClient: false,
  },
  {
    id: 'new-expense',
    title: '+ Record Expense',
    path: '/expenses/create',
    description: 'Log an operational or project billable cost',
    keywords: ['add expense', 'new cost', 'record receipt'],
    permission: 'crm.expenses.write',
    allowClient: false,
  },
  {
    id: 'new-ticket',
    title: '+ Submit Support Ticket',
    path: '/tickets/create',
    description: 'Open a customer service inquiry or bug ticket',
    keywords: ['add ticket', 'new ticket', 'report issue', 'help'],
    permission: 'crm.tickets.write',
    allowClient: true,
  },
];

export const GlobalSearchBar: React.FC = () => {
  const { hasPermission, hasAnyPermission, isClient, activeRole } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordResults, setRecordResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. RBAC Filtered Modules
  const permittedModules = useMemo(() => {
    return ALL_MODULES.filter((mod) => {
      if (isClient && !mod.allowClient) return false;
      if (mod.anyOf?.length) return hasAnyPermission(...mod.anyOf);
      if (!mod.permission) return true;
      return hasPermission(mod.permission);
    });
  }, [hasPermission, hasAnyPermission, isClient]);

  // 2. RBAC Filtered Actions
  const permittedActions = useMemo(() => {
    return ALL_ACTIONS.filter((act) => {
      if (isClient && !act.allowClient) return false;
      const allowed = act.anyOf?.length
        ? hasAnyPermission(...act.anyOf)
        : act.permission
          ? hasPermission(act.permission)
          : false;
      if (!allowed) return false;
      if (
        act.id === 'new-task' &&
        !canFullyManageTasks({
          hasTaskWrite: true,
          isClient,
          activeRole,
        })
      ) {
        return false;
      }
      return true;
    });
  }, [hasPermission, hasAnyPermission, isClient, activeRole]);

  // Filter modules & actions matching the text query
  const matchingModules = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return permittedModules
      .filter((mod) => {
        return (
          mod.title.toLowerCase().includes(q) ||
          mod.description.toLowerCase().includes(q) ||
          mod.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
      .slice(0, 5)
      .map((mod) => ({
        id: `mod-${mod.id}`,
        title: mod.title,
        subtitle: mod.description,
        category: 'Modules',
        path: mod.path,
        badge: 'Module',
        icon: mod.icon,
      }));
  }, [permittedModules, query]);

  const matchingActions = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return permittedActions
      .filter((act) => {
        return (
          act.title.toLowerCase().includes(q) ||
          act.description.toLowerCase().includes(q) ||
          act.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
      .slice(0, 4)
      .map((act) => ({
        id: `act-${act.id}`,
        title: act.title,
        subtitle: act.description,
        category: 'Actions',
        path: act.path,
        badge: 'Quick Action',
        icon: <AddCircleOutlineIcon sx={{ fontSize: 18, color: '#2563eb' }} />,
      }));
  }, [permittedActions, query]);

  // 3. Live Record Fetching (Strictly RBAC Scoped)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRecordResults([]);
      setLoadingRecords(false);
      return;
    }

    let isCancelled = false;
    setLoadingRecords(true);

    const timer = setTimeout(async () => {
      const items: SearchResultItem[] = [];

      try {
        const promises: Promise<void>[] = [];

        // Leads (Non-client + crm.leads.read)
        if (!isClient && hasPermission('crm.leads.read')) {
          promises.push(
            crmApi
              .getLeads({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((lead) => {
                  items.push({
                    id: `lead-${lead._id}`,
                    title: lead.name,
                    subtitle: [lead.company, lead.email].filter(Boolean).join(' · ') || 'Lead record',
                    category: 'Leads',
                    path: `/leads/${lead._id}`,
                    badge: lead.status || lead.stage || 'Lead',
                    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <TrackChangesIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Clients (Non-client + crm.clients.read)
        if (!isClient && hasPermission('crm.clients.read')) {
          promises.push(
            crmApi
              .listClients({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((client) => {
                  items.push({
                    id: `client-${client._id}`,
                    title: client.name || client.companyName || 'Unnamed Client',
                    subtitle: [client.email, client.phone].filter(Boolean).join(' · ') || 'Client account',
                    category: 'Clients',
                    path: `/clients/${client._id}`,
                    badge: client.status || 'Client',
                    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: <BusinessOutlinedIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Projects (crm.projects.read OR isClient)
        if (hasPermission('crm.projects.read') || isClient) {
          promises.push(
            crmApi
              .listProjects({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((project) => {
                  const pId = project._id;
                  items.push({
                    id: `proj-${pId}`,
                    title: project.name || 'Unnamed Project',
                    subtitle: [project.clientName, project.status].filter(Boolean).join(' · ') || 'Project workspace',
                    category: 'Projects',
                    path: `/projects/${pId}`,
                    badge: project.status || 'Project',
                    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
                    icon: <FolderOutlinedIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Tasks (crm.tasks.read OR isClient)
        if (hasPermission('crm.tasks.read') || isClient) {
          promises.push(
            crmApi
              .listTasks({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((task) => {
                  const tId = task._id;
                  items.push({
                    id: `task-${tId}`,
                    title: task.title || 'Untitled Task',
                    subtitle: [task.projectName, task.priority, task.status].filter(Boolean).join(' · ') || 'Task deliverable',
                    category: 'Tasks',
                    path: `/tasks/${tId}`,
                    badge: task.priority || task.status || 'Task',
                    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: <ChecklistOutlinedIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Invoices (crm.finance.read OR isClient)
        if (hasPermission('crm.finance.read') || isClient) {
          promises.push(
            crmApi
              .listInvoices({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((inv) => {
                  const iId = inv._id;
                  const totalVal = inv.grandTotal ?? inv.subtotal ?? 0;
                  items.push({
                    id: `inv-${iId}`,
                    title: inv.invoiceNo || 'Invoice Record',
                    subtitle: [inv.clientName, inv.status, totalVal ? `₹${Number(totalVal).toLocaleString('en-IN')}` : '']
                      .filter(Boolean)
                      .join(' · '),
                    category: 'Invoices',
                    path: `/invoices/${iId}`,
                    badge: inv.status || 'Invoice',
                    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                    icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Tickets (crm.tickets.read OR isClient)
        if (hasPermission('crm.tickets.read') || isClient) {
          promises.push(
            crmApi
              .listTickets({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((ticket) => {
                  const tkId = ticket._id;
                  items.push({
                    id: `ticket-${tkId}`,
                    title: ticket.subject || ticket.ticketNumber || 'Support Ticket',
                    subtitle: [ticket.ticketNumber, ticket.requesterCompany || ticket.requesterName, String(ticket.status || '')]
                      .filter(Boolean)
                      .join(' · '),
                    category: 'Tickets',
                    path: `/tickets/${tkId}`,
                    badge: String(ticket.status || ticket.priority || 'Ticket'),
                    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
                    icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        // Opportunities (Non-client + crm.opportunities.read)
        if (!isClient && hasPermission('crm.opportunities.read')) {
          promises.push(
            crmApi
              .listOpportunities({ search: trimmed, limit: 4 })
              .then((res) => {
                if (isCancelled || !Array.isArray(res.data)) return;
                res.data.slice(0, 4).forEach((opp) => {
                  const oId = opp._id;
                  items.push({
                    id: `opp-${oId}`,
                    title: opp.title || 'Sales Opportunity',
                    subtitle: [opp.stage, opp.value ? `₹${Number(opp.value).toLocaleString('en-IN')}` : '']
                      .filter(Boolean)
                      .join(' · '),
                    category: 'Opportunities',
                    path: '/opportunities',
                    badge: opp.stage || 'Deal',
                    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,
                  });
                });
              })
              .catch(() => {})
          );
        }

        await Promise.allSettled(promises);
        if (!isCancelled) {
          setRecordResults(items);
        }
      } finally {
        if (!isCancelled) {
          setLoadingRecords(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, hasPermission, isClient]);

  // Combine items for keyboard navigation and rendering
  const activeResultsList = useMemo<SearchResultItem[]>(() => {
    const q = query.trim();
    if (!q) {
      // Default: show recommended permitted modules + quick actions
      const mods: SearchResultItem[] = permittedModules.slice(0, 8).map((mod) => ({
        id: `mod-${mod.id}`,
        title: mod.title,
        subtitle: mod.description,
        category: 'Modules',
        path: mod.path,
        badge: 'Permitted',
        icon: mod.icon,
      }));
      const acts: SearchResultItem[] = permittedActions.slice(0, 4).map((act) => ({
        id: `act-${act.id}`,
        title: act.title,
        subtitle: act.description,
        category: 'Actions',
        path: act.path,
        badge: 'Action',
        icon: <AddCircleOutlineIcon sx={{ fontSize: 18, color: '#2563eb' }} />,
      }));
      return [...acts, ...mods];
    }
    return [...matchingActions, ...matchingModules, ...recordResults];
  }, [query, permittedModules, permittedActions, matchingActions, matchingModules, recordResults]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeResultsList.length]);

  // Global hotkey: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      setIsOpen(false);
      setQuery('');
      navigate(item.path);
    },
    [navigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < activeResultsList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : activeResultsList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = activeResultsList[selectedIndex];
      if (current) {
        handleSelect(current);
      }
    }
  };

  // Group items by category for rendering
  const groupedResults = useMemo(() => {
    const map = new Map<string, SearchResultItem[]>();
    activeResultsList.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [activeResultsList]);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-lg mx-2 sm:mx-6">
      {/* Search Input Bar */}
      <div
        className={`flex items-center gap-2 bg-zinc-50 border rounded-lg px-3 py-1.5 transition-all ${
          isOpen
            ? 'bg-white border-zinc-950 ring-1 ring-zinc-950 shadow-sm'
            : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100/60'
        }`}
      >
        <SearchIcon sx={{ fontSize: 18, color: '#71717a' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            isClient
              ? 'Search your projects, tasks, tickets & invoices... (Ctrl+K)'
              : 'Search modules, leads, projects, tasks... (Ctrl+K)'
          }
          className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 outline-none border-0 font-medium p-0"
        />

        {loadingRecords && (
          <CircularProgress size={14} thickness={5} sx={{ color: '#71717a' }} />
        )}

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 border-0 bg-transparent cursor-pointer flex items-center"
            title="Clear query (Esc)"
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1 select-none pointer-events-none">
            <span className="text-[10px] font-mono font-semibold bg-zinc-200/80 text-zinc-600 px-1.5 py-0.5 rounded">
              Ctrl K
            </span>
          </div>
        )}
      </div>

      {/* Dropdown Results Box */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ maxHeight: '460px', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header Info Bar */}
          <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <div className="flex items-center gap-1.5">
              <LockOutlinedIcon sx={{ fontSize: 13, color: '#09090b' }} />
              <span>
                RBAC Access Scoped: <strong className="text-zinc-900 font-semibold">{activeRole}</strong>
              </span>
            </div>
            <span>
              {query.trim() ? `${activeResultsList.length} matches` : 'Permitted shortcuts'}
            </span>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 py-1">
            {activeResultsList.length === 0 && !loadingRecords && (
              <div className="p-6 text-center text-zinc-400">
                <SearchIcon sx={{ fontSize: 24, color: '#a1a1aa', mb: 1 }} />
                <p className="text-xs m-0 font-medium text-zinc-600">
                  No matching items found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 mb-0">
                  Search results are strictly restricted to data and modules permitted by your role (
                  {activeRole}).
                </p>
              </div>
            )}

            {Array.from(groupedResults.entries()).map(([category, items]) => (
              <div key={category} className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>{category}</span>
                  <span className="font-normal font-mono text-[9px] lowercase text-zinc-400">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {items.map((item) => {
                  const globalIndex = activeResultsList.indexOf(item);
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 border-0 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-white text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-zinc-900 truncate leading-tight flex items-center gap-1.5">
                            <span>{item.title}</span>
                            {item.badge && (
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                                  item.badgeColor || 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5 leading-none">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center text-zinc-400">
                        <ArrowForwardIcon sx={{ fontSize: 13, opacity: isSelected ? 1 : 0.4 }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer Keyboard Hints */}
          <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="bg-white border border-zinc-200 px-1 py-0.5 rounded text-zinc-600 font-mono">
                  ↑
                </kbd>{' '}
                <kbd className="bg-white border border-zinc-200 px-1 py-0.5 rounded text-zinc-600 font-mono">
                  ↓
                </kbd>{' '}
                to navigate
              </span>
              <span>
                <kbd className="bg-white border border-zinc-200 px-1 py-0.5 rounded text-zinc-600 font-mono">
                  ↵
                </kbd>{' '}
                to select
              </span>
              <span>
                <kbd className="bg-white border border-zinc-200 px-1 py-0.5 rounded text-zinc-600 font-mono">
                  Esc
                </kbd>{' '}
                to close
              </span>
            </div>
            <span className="hidden sm:inline font-mono text-[9px] text-zinc-400">
              Root CRM Search
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
