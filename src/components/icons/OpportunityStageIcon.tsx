import React from 'react';
import {
  CheckCircle2,
  Handshake,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  TestTube2,
  Trophy,
  XCircle,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

export type OpportunityStageIconKey =
  | 'search'
  | 'clipboard'
  | 'test-tube'
  | 'check'
  | 'message'
  | 'mail'
  | 'trophy'
  | 'handshake'
  | 'x'
  | 'pin';

const STAGE_ICONS: Record<OpportunityStageIconKey, LucideIcon> = {
  search: Search,
  clipboard: ClipboardList,
  'test-tube': TestTube2,
  check: CheckCircle2,
  message: MessageCircle,
  mail: Mail,
  trophy: Trophy,
  handshake: Handshake,
  x: XCircle,
  pin: MapPin,
};

export const OPPORTUNITY_STAGE_ICON_BY_KEY: Record<string, OpportunityStageIconKey> = {
  Discovery: 'search',
  'Requirement Confirmed': 'clipboard',
  'Product Validated': 'test-tube',
  'Sample Approved': 'check',
  'Commercial Discussion': 'message',
  'Quotation Sent': 'mail',
  Won: 'trophy',
  Negotiation: 'handshake',
  Lost: 'x',
};

export function OpportunityStageIcon({
  iconKey,
  className = 'h-4 w-4 shrink-0',
}: {
  iconKey: string;
  className?: string;
}): React.ReactElement {
  const key = (iconKey in STAGE_ICONS ? iconKey : 'pin') as OpportunityStageIconKey;
  const Icon = STAGE_ICONS[key] ?? MapPin;
  return <Icon className={className} aria-hidden />;
}
