import React from 'react';
import {
  CreditCard,
  Crown,
  FolderKanban,
  Laptop,
  Target,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { CrmRole } from '../../types/dashboard';

const ROLE_ICONS: Record<CrmRole, LucideIcon> = {
  'crm-manager': Crown,
  'sales-manager': TrendingUp,
  'sales-representative': Target,
  'project-manager': FolderKanban,
  'crm-employee': Laptop,
  'finance-manager': CreditCard,
  client: User,
};

export function CrmRoleIcon({
  role,
  className = 'h-4 w-4 shrink-0',
}: {
  role: string;
  className?: string;
}): React.ReactElement {
  const Icon = ROLE_ICONS[role as CrmRole] ?? User;
  return <Icon className={className} aria-hidden />;
}
