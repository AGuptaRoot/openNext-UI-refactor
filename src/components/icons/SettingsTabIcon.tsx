import React from 'react';
import {
  Building2,
  Briefcase,
  FolderKanban,
  Mail,
  Plug,
  Ruler,
  Settings,
  Shield,
  Tag,
  Target,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { SettingsTabId } from '../../types/admin';

const TAB_ICONS: Record<SettingsTabId, LucideIcon> = {
  general: Building2,
  shipping: Truck,
  finance: Wallet,
  email: Mail,
  integrations: Plug,
  projects: FolderKanban,
  'project-statuses': Tag,
  leads: Target,
  'qualification-match': Ruler,
  opportunities: Briefcase,
  clients: Users,
  users: Shield,
};

export function SettingsTabIcon({
  tabId,
  className = 'h-[18px] w-[18px] shrink-0',
}: {
  tabId: SettingsTabId | string;
  className?: string;
}): React.ReactElement {
  const Icon = TAB_ICONS[tabId as SettingsTabId] ?? Settings;
  return <Icon className={className} aria-hidden />;
}
