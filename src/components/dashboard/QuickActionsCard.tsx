import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import FolderPlusOutlinedIcon from '@mui/icons-material/FolderSpecialOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { useAuth } from '../../context/AuthContext';
import { canCreateTasks } from '../../utils/permissions';
import { CrmRole } from '../../types/dashboard';

interface QuickActionsCardProps {
  onNavigateUnmigrated: (moduleName: string) => void;
}

interface ActionItem {
  id: string;
  label: string;
  module: string;
  path: string;
  icon: React.ReactNode;
  /** Required CRM permission key */
  permission?: string;
  /** If set, user needs any one of these (takes precedence over `permission`). */
  anyOf?: string[];
  /** When false, never show for client / client-preview personas */
  allowClient: boolean;
  /** If set, only these roles see the action (still requires permission). */
  roles?: CrmRole[];
  /** Roles that should never see this shortcut even if they have the permission. */
  excludeRoles?: CrmRole[];
}

/** Delivery roles: project / delivery focus — no sales or finance create shortcuts. */
const DELIVERY_ROLES: CrmRole[] = ['project-manager', 'crm-employee'];

const ALL_QUICK_ACTIONS: ActionItem[] = [
  {
    id: 'lead',
    label: 'New Lead',
    module: 'Leads',
    path: '/leads/create',
    icon: <PersonAddOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.leads.write',
    allowClient: false,
    excludeRoles: [...DELIVERY_ROLES, 'finance-manager'],
  },
  {
    id: 'client',
    label: 'New Client',
    module: 'Clients',
    path: '/clients/create',
    icon: <BusinessOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.clients.write',
    allowClient: false,
    excludeRoles: [...DELIVERY_ROLES, 'finance-manager'],
  },
  {
    id: 'opportunity',
    label: 'New Deal',
    module: 'Opportunities',
    path: '/opportunities/create',
    icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.opportunities.write',
    allowClient: false,
    excludeRoles: [...DELIVERY_ROLES, 'finance-manager'],
  },
  {
    id: 'project',
    label: 'New Project',
    module: 'Projects',
    path: '/projects/create',
    icon: <FolderPlusOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.projects.write',
    allowClient: false,
    excludeRoles: ['finance-manager', 'sales-representative'],
  },
  {
    id: 'task',
    label: 'New Task',
    module: 'Tasks',
    path: '/tasks/create',
    icon: <ChecklistOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.tasks.write',
    allowClient: false,
  },
  {
    id: 'invoice',
    label: 'New Invoice',
    module: 'Invoices',
    path: '/invoices/create',
    icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.finance.write',
    allowClient: false,
    excludeRoles: [...DELIVERY_ROLES, 'sales-representative'],
  },
  {
    id: 'quote',
    label: 'New Quote',
    module: 'Quotations',
    path: '/quotations/create',
    icon: <NoteAltOutlinedIcon sx={{ fontSize: 16 }} />,
    anyOf: ['crm.quotes.write', 'crm.finance.write'],
    allowClient: false,
    excludeRoles: [...DELIVERY_ROLES, 'finance-manager'],
  },
  {
    id: 'time',
    label: 'Log Time',
    module: 'Time Logs',
    path: '/time-logs?action=log',
    icon: <MoreTimeOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.time.write',
    allowClient: false,
    excludeRoles: ['finance-manager'],
  },
  {
    id: 'expense',
    label: 'New Expense',
    module: 'Expenses',
    path: '/expenses/create',
    icon: <AttachMoneyOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.expenses.write',
    allowClient: false,
    // Project managers submit expenses from Expenses module — not a dashboard shortcut
    excludeRoles: ['project-manager', 'sales-representative', 'client'],
  },
  {
    id: 'ticket',
    label: 'New Ticket',
    module: 'Tickets',
    path: '/tickets/create',
    icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: 16 }} />,
    permission: 'crm.tickets.write',
    allowClient: true,
  },
];

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onNavigateUnmigrated,
}) => {
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, isClient, activeRole } = useAuth();

  const actions = useMemo(() => {
    return ALL_QUICK_ACTIONS.filter((act) => {
      if (isClient && !act.allowClient) return false;
      if (act.roles?.length && !act.roles.includes(activeRole)) return false;
      if (act.excludeRoles?.includes(activeRole)) return false;
      const allowed = act.anyOf?.length
        ? hasAnyPermission(...act.anyOf)
        : act.permission
          ? hasPermission(act.permission)
          : false;
      if (!allowed) return false;
      if (
        act.id === 'task' &&
        !canCreateTasks({
          hasTaskWrite: true,
          isClient,
        })
      ) {
        return false;
      }
      return true;
    });
  }, [hasPermission, hasAnyPermission, isClient, activeRole]);

  const handleActionClick = (act: ActionItem) => {
    if (isClient && !act.allowClient) return;
    if (act.roles?.length && !act.roles.includes(activeRole)) return;
    if (act.excludeRoles?.includes(activeRole)) return;
    const allowed = act.anyOf?.length
      ? hasAnyPermission(...act.anyOf)
      : act.permission
        ? hasPermission(act.permission)
        : false;
    if (!allowed) return;
    if (act.path) {
      navigate(act.path);
      return;
    }
    onNavigateUnmigrated(act.module);
  };

  if (actions.length === 0) return null;

  return (
    <div data-tour="dashboard-quick-actions" className="bg-white border border-zinc-300 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-950 m-0">Quick Actions</h3>
        <div className="w-6 h-6 rounded bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200">
          <FlashOnIcon sx={{ fontSize: 15 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((act) => (
          <button
            key={act.id}
            type="button"
            onClick={() => handleActionClick(act)}
            className="p-2 rounded-lg border border-zinc-300 bg-white hover:border-zinc-950 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer text-left transition-all duration-150"
          >
            <div className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-950 flex items-center justify-center flex-shrink-0 border border-zinc-200">
              {act.icon}
            </div>
            <span className="text-[11.5px] font-semibold text-zinc-900 truncate">
              {act.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
