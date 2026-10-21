import React from 'react';
import {
  Building2,
  Briefcase,
  FolderKanban,
  Mail,
  Plug,
  Ruler,
  Settings,
  Puzzle,
  Shield,
  Tag,
  Target,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { SettingsTabId } from '../../types/admin';

const TAB_ICONS: Record<string, LucideIcon> = {
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

function resolveSettingsIcon(tabId: SettingsTabId | string): LucideIcon {
  if (TAB_ICONS[tabId]) return TAB_ICONS[tabId];
  if (String(tabId).startsWith('ext__')) return Puzzle;
  return Settings;
}

export function SettingsTabIcon({
  tabId,
  className = 'h-[18px] w-[18px] shrink-0',
}: {
  tabId: SettingsTabId | string;
  className?: string;
}): React.ReactElement {
  const Icon = resolveSettingsIcon(tabId);
  return <Icon className={className} aria-hidden />;
}
