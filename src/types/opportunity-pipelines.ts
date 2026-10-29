/** Internal stage types used by CRM workflows (independent of visible labels). */
export type OpportunityStageType =
  | 'OPEN'
  | 'SAMPLE_SENT'
  | 'SAMPLE_APPROVED'
  | 'QUOTATION_SENT'
  | 'NEGOTIATION'
  | 'QUOTATION_ACCEPTED'
  | 'WON'
  | 'LOST';

export const OPPORTUNITY_STAGE_TYPES: OpportunityStageType[] = [
  'OPEN',
  'SAMPLE_SENT',
  'SAMPLE_APPROVED',
  'QUOTATION_SENT',
  'NEGOTIATION',
  'QUOTATION_ACCEPTED',
  'WON',
  'LOST',
];

export const STAGE_TYPE_LABELS: Record<OpportunityStageType, string> = {
  OPEN: 'Open / Normal',
  SAMPLE_SENT: 'Sample Sent',
  SAMPLE_APPROVED: 'Sample Approved',
  QUOTATION_SENT: 'Quotation Sent',
  NEGOTIATION: 'Negotiation',
  QUOTATION_ACCEPTED: 'Quotation Accepted',
  WON: 'Won',
  LOST: 'Lost',
};

/** Preset catalog for “Add Default Stage”. */
export const DEFAULT_STAGE_CATALOG: Array<{
  label: string;
  type: OpportunityStageType;
  probability: number;
}> = [
  { label: 'Sample Sent', type: 'SAMPLE_SENT', probability: 45 },
  { label: 'Sample Approved', type: 'SAMPLE_APPROVED', probability: 55 },
  { label: 'Quotation Sent', type: 'QUOTATION_SENT', probability: 95 },
  { label: 'Quotation Accepted', type: 'QUOTATION_ACCEPTED', probability: 98 },
  { label: 'Won', type: 'WON', probability: 100 },
  { label: 'Negotiation', type: 'NEGOTIATION', probability: 85 },
  { label: 'Lost', type: 'LOST', probability: 0 },
];

export interface OpportunityPipelineStage {
  id: string;
  label: string;
  type: OpportunityStageType;
  probability: number;
}

export interface OpportunityPipeline {
  _id: string;
  name: string;
  pipelineKey?: string;
  extensionId?: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  isEnabled: boolean;
  quotationWorkflowEnabled: boolean;
  stages: OpportunityPipelineStage[];
  opportunityCount?: number;
  canDelete?: boolean;
  stageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpportunityPipelineInput {
  name: string;
  description?: string;
  quotationWorkflowEnabled?: boolean;
  isEnabled?: boolean;
  stages: Array<{
    id?: string;
    label: string;
    type: OpportunityStageType;
    probability?: number;
  }>;
}

export function makeLocalStageId(index = 0): string {
  return `stage_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildDefaultPipelineStages(): OpportunityPipelineStage[] {
  return [
    { id: makeLocalStageId(0), label: 'Discovery', type: 'OPEN', probability: 10 },
    { id: makeLocalStageId(1), label: 'Requirement Confirmed', type: 'OPEN', probability: 25 },
    { id: makeLocalStageId(2), label: 'Product Validated', type: 'OPEN', probability: 40 },
    { id: makeLocalStageId(3), label: 'Sample Approved', type: 'SAMPLE_APPROVED', probability: 55 },
    { id: makeLocalStageId(4), label: 'Quotation Sent', type: 'QUOTATION_SENT', probability: 95 },
    { id: makeLocalStageId(5), label: 'Won', type: 'WON', probability: 100 },
    { id: makeLocalStageId(6), label: 'Negotiation', type: 'NEGOTIATION', probability: 85 },
    { id: makeLocalStageId(7), label: 'Lost', type: 'LOST', probability: 0 },
  ];
}

export function validatePipelineStagesClient(
  stages: OpportunityPipelineStage[],
  { quotationWorkflowEnabled = true }: { quotationWorkflowEnabled?: boolean } = {}
): string[] {
  const errors: string[] = [];
  if (stages.length < 5) errors.push('A pipeline must contain at least 5 stages.');
  const labels = new Set<string>();
  for (const stage of stages) {
    const label = String(stage.label || '').trim();
    if (!label) errors.push('Every stage needs a label.');
    const key = label.toLowerCase();
    if (labels.has(key)) errors.push(`Duplicate stage label: ${label}`);
    labels.add(key);
  }
  const types = new Set(stages.map((s) => s.type));
  if (!stages.some((s) => s.type !== 'WON' && s.type !== 'LOST')) {
    errors.push('Pipeline must include at least one open/normal sales stage.');
  }
  if (!types.has('WON')) errors.push('Pipeline must include a Won stage.');
  if (!types.has('LOST')) errors.push('Pipeline must include a Lost stage.');
  if (quotationWorkflowEnabled) {
    if (!types.has('QUOTATION_SENT')) {
      errors.push('Quotation workflow requires a Quotation Sent stage.');
    }
    if (!types.has('NEGOTIATION')) {
      errors.push('Quotation workflow requires a Negotiation stage.');
    }
  }
  return errors;
}

export function isProtectedStageType(type: OpportunityStageType): boolean {
  return type === 'WON' || type === 'LOST';
}
