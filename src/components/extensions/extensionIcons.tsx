import React from 'react';
import {
  FileText,
  File,
  Shield,
  Briefcase,
  Wrench,
  Package,
  Activity,
  Puzzle,
  Sparkles,
  Settings,
  Database,
  Layers,
  Globe,
  Plane,
  Calendar,
  Compass,
  Clock,
  Users,
  HelpCircle,
  Folder,
  Tag,
  CheckSquare,
  BarChart2,
  Inbox,
  CalendarCheck,
  Map as MapIcon,
  Ticket,
  type LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'file-text': FileText,
  file: File,
  shield: Shield,
  briefcase: Briefcase,
  tool: Wrench,
  wrench: Wrench,
  package: Package,
  activity: Activity,
  puzzle: Puzzle,
  sparkles: Sparkles,
  settings: Settings,
  database: Database,
  layers: Layers,
  globe: Globe,
  plane: Plane,
  calendar: Calendar,
  compass: Compass,
  clock: Clock,
  users: Users,
  help: HelpCircle,
  folder: Folder,
  tag: Tag,
  check: CheckSquare,
  chart: BarChart2,
  inbox: Inbox,
  'calendar-check': CalendarCheck,
  map: MapIcon,
  ticket: Ticket,
};

const SVG_MAP: Record<string, string> = {
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  'calendar-check': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  puzzle: '<path d="M19.439 7.85c-.049-.955-.24-1.873-.559-2.72a8.01 8.01 0 0 0-1.83-2.6A7.98 7.98 0 0 0 14.33.7c-.847-.32-1.765-.51-2.72-.56-.955-.05-1.92.05-2.85.3A7.99 7.99 0 0 0 3.02 5.09a8.03 8.03 0 0 0-1.84 2.6c-.32.847-.51 1.765-.56 2.72-.05.955.05 1.92.3 2.85a8.04 8.04 0 0 0 4.65 5.74c.847.32 1.765.51 2.72.56.955.05 1.92-.05 2.85-.3a8 8 0 0 0 5.74-4.65c.32-.847.51-1.765.56-2.72.05-.955-.05-1.92-.3-2.85-.25-.93-.68-1.81-1.28-2.58z"/>',
  sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
};

/**
 * Returns a React Lucide icon component matching the icon key declared in the extension manifest.
 * Defaults to `Puzzle` when unmatched.
 */
export function getExtensionIcon(
  iconKey?: string | null,
  props: LucideProps = { className: 'h-4 w-4' }
): React.ReactElement {
  const normalized = String(iconKey || '')
    .trim()
    .toLowerCase()
    .replace(/^lucide[:-]/, '');

  const IconComp = ICON_MAP[normalized] || Puzzle;
  return <IconComp {...props} />;
}

/**
 * Returns raw inner SVG markup for DOM injection in the sidebar.
 */
export function getExtensionIconSvg(iconKey?: string | null): string {
  const normalized = String(iconKey || '')
    .trim()
    .toLowerCase()
    .replace(/^lucide[:-]/, '');

  const inner = SVG_MAP[normalized] || SVG_MAP['puzzle'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${normalized || 'puzzle'}">${inner}</svg>`;
}
