export type RequestFieldType = 'text' | 'number' | 'select' | 'radio' | 'multiselect';

export const REQUEST_FIELD_TYPE_OPTIONS: Array<{ value: RequestFieldType; label: string }> = [
  { value: 'text', label: 'Plain Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'select', label: 'Single Select' },
  { value: 'radio', label: 'Radio selection' },
  { value: 'multiselect', label: 'Multi-Select / Checkbox List' },
];

export interface RequestTypeOption {
  id: string;
  label: string;
  value: string;
}

export interface RequestTypeField {
  id: string;
  key: string;
  label: string;
  type: RequestFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: RequestTypeOption[];
  matchValues: string[];
  matchNumberMin: number | null;
  matchNumberMax: number | null;
  matchEnabled: boolean;
  minAmount?: number | null;
  maxAmount?: number | null;
}

export interface RequestType {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  isSystem?: boolean;
  minBudget?: number | null;
  maxBudget?: number | null;
  fields: RequestTypeField[];
  sortOrder?: number;
  leadCount?: number;
  canDelete?: boolean;
  fieldCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RequestTypeInput {
  name: string;
  key?: string;
  description?: string;
  isEnabled?: boolean;
  minBudget?: number | null;
  maxBudget?: number | null;
  fields: RequestTypeField[];
  sortOrder?: number;
}

export type DynamicFieldValues = Record<string, string | number | string[] | null>;

/** Lead-only selectable options (not shared with other leads until promoted). */
export type LeadCustomFieldOptions = Record<
  string,
  Array<{ value: string; label: string }>
>;

export function isSelectableFieldType(type: RequestFieldType | string): boolean {
  return type === 'select' || type === 'radio' || type === 'multiselect';
}

export interface QualificationScorePart {
  key: string;
  label: string;
  score: number;
  detail: string;
  status?: string;
}

export function makeLocalId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function slugifyFieldKey(value: string, fallback = 'field'): string {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
  return base || fallback;
}

export function emptyRequestTypeField(partial?: Partial<RequestTypeField>): RequestTypeField {
  const label = partial?.label || 'New Field';
  return {
    id: partial?.id || makeLocalId('fld'),
    key: partial?.key || slugifyFieldKey(label),
    label,
    type: partial?.type || 'text',
    required: partial?.required ?? false,
    placeholder: partial?.placeholder || '',
    helpText: partial?.helpText || '',
    options: partial?.options || [],
    matchValues: partial?.matchValues || [],
    matchNumberMin: partial?.matchNumberMin ?? null,
    matchNumberMax: partial?.matchNumberMax ?? null,
    matchEnabled: partial?.matchEnabled !== false,
    minAmount: partial?.minAmount ?? partial?.matchNumberMin ?? null,
    maxAmount: partial?.maxAmount ?? partial?.matchNumberMax ?? null,
  };
}

export function createDefaultBudgetField(
  minBudget?: number | null,
  maxBudget?: number | null
): RequestTypeField {
  const min = minBudget != null && Number.isFinite(Number(minBudget)) ? Number(minBudget) : null;
  const max = maxBudget != null && Number.isFinite(Number(maxBudget)) ? Number(maxBudget) : null;
  return {
    id: makeLocalId('fld_budget'),
    key: 'budget',
    label: 'Budget',
    type: 'number',
    required: true,
    placeholder: 'Enter commercial budget amount',
    helpText: 'Required commercial requirement budget (number)',
    options: [],
    matchValues: [],
    matchNumberMin: min,
    matchNumberMax: max,
    minAmount: min,
    maxAmount: max,
    matchEnabled: true,
  };
}

export function ensureBudgetField(
  fields: RequestTypeField[],
  minBudget?: number | null,
  maxBudget?: number | null
): RequestTypeField[] {
  const list = [...fields];
  const budgetIdx = list.findIndex(
    (f) => f.key === 'budget' || f.label.trim().toLowerCase() === 'budget'
  );
  const min = minBudget != null && Number.isFinite(Number(minBudget)) ? Number(minBudget) : null;
  const max = maxBudget != null && Number.isFinite(Number(maxBudget)) ? Number(maxBudget) : null;

  if (budgetIdx >= 0) {
    const existing = list[budgetIdx];
    list[budgetIdx] = {
      ...existing,
      key: 'budget',
      type: 'number',
      required: true,
      matchNumberMin: min ?? existing.matchNumberMin ?? null,
      matchNumberMax: max ?? existing.matchNumberMax ?? null,
      minAmount: min ?? existing.minAmount ?? existing.matchNumberMin ?? null,
      maxAmount: max ?? existing.maxAmount ?? existing.matchNumberMax ?? null,
      matchEnabled: existing.matchEnabled !== false,
    };
  } else {
    list.unshift(createDefaultBudgetField(min, max));
  }
  return list;
}

export function emptyRequestTypeDraft(): {
  name: string;
  description: string;
  isEnabled: boolean;
  minBudget: number | null;
  maxBudget: number | null;
  fields: RequestTypeField[];
} {
  return {
    name: '',
    description: '',
    isEnabled: true,
    minBudget: null,
    maxBudget: null,
    fields: [createDefaultBudgetField()],
  };
}

export function needsOptions(type: RequestFieldType): boolean {
  return type === 'select' || type === 'radio' || type === 'multiselect';
}
