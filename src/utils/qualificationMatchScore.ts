/**
 * Qualification match scoring
 *
 * Admin defines catalogs under Settings → Qualification Match.
 * Commercial Requirement on a lead is scored against those catalogs.
 *
 * Rules (equal weight per criterion that has a commercial value):
 * - Single select (software type, category, specification, users band):
 *     100 if value exists in admin catalog (case-insensitive), else 0
 * - Multi select / checkboxes (technologies, integrations, certifications):
 *     100 * (matched selected / total selected); 0 if none selected are in catalog
 * - Criteria with empty commercial value are skipped (not counted against score)
 * - Overall score = average of included criterion scores (0–100)
 */

export interface QualificationMatchCatalog {
  projectSoftwareTypes: string[];
  projectTechnologies: string[];
  projectUserBands: string[];
  projectIntegrations: string[];
  productCategories: string[];
  productSpecifications: string[];
  productCertifications: string[];
}

export interface ProjectCommercialRequirement {
  softwareType: string;
  technologies: string[];
  modulesFeatures: string[];
  numberOfUsers: string;
  integrations: string[];
  budget: number | null;
  expectedDelivery: string;
}

export interface ProductCommercialRequirement {
  productName: string;
  category: string;
  specification: string;
  targetPrice: string;
  certifications: string[];
  quantity: number | null;
}

export interface LeadCommercialRequirement {
  kind: 'project' | 'product' | 'dynamic' | '';
  requestTypeId?: string | null;
  requestTypeKey?: string;
  values?: Record<string, string | number | string[] | null>;
  /** Lead-specific selectable options keyed by field.key */
  customOptions?: Record<string, Array<{ value: string; label: string }>>;
  /** Product request types only — lead needs a sample request. */
  needsSampleRequest?: boolean;
  matchedRequirements?: QualificationScoreBreakdownItem[];
  unmatchedRequirements?: QualificationScoreBreakdownItem[];
  missingRequirements?: QualificationScoreBreakdownItem[];
  project: ProjectCommercialRequirement;
  product: ProductCommercialRequirement;
  score?: number | null;
  scoreBreakdown?: QualificationScoreBreakdownItem[];
  scoredAt?: string | null;
}

export interface QualificationScoreBreakdownItem {
  key: string;
  label: string;
  score: number;
  detail: string;
  status?: string;
}

export const DEFAULT_QUALIFICATION_MATCH_CATALOG: QualificationMatchCatalog = {
  projectSoftwareTypes: [
    'Web App',
    'Mobile App',
    'Embedded System',
    'Desktop Software',
    'Other',
  ],
  projectTechnologies: ['React', 'Next.js', 'Node.js', 'Python', '.NET', 'Java', 'Flutter'],
  projectUserBands: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
  projectIntegrations: [
    'CRM',
    'ERP',
    'Payment Gateway',
    'Email / SMS',
    'Accounting',
    'Custom API',
  ],
  productCategories: [
    'Hardware',
    'Software License',
    'SaaS Subscription',
    'Accessory',
    'Spare Part',
  ],
  productSpecifications: ['Standard', 'Premium', 'Custom', 'Industrial Grade'],
  productCertifications: ['ISO', 'CE', 'BIS', 'RoHS', 'None'],
};

export function emptyProjectCommercial(): ProjectCommercialRequirement {
  return {
    softwareType: '',
    technologies: [],
    modulesFeatures: [],
    numberOfUsers: '',
    integrations: [],
    budget: null,
    expectedDelivery: '',
  };
}

export function emptyProductCommercial(): ProductCommercialRequirement {
  return {
    productName: '',
    category: '',
    specification: '',
    targetPrice: '',
    certifications: [],
    quantity: null,
  };
}

export function emptyCommercialRequirement(
  kind: LeadCommercialRequirement['kind'] = ''
): LeadCommercialRequirement {
  return {
    kind,
    requestTypeId: null,
    requestTypeKey: '',
    values: {},
    customOptions: {},
    needsSampleRequest: false,
    matchedRequirements: [],
    unmatchedRequirements: [],
    missingRequirements: [],
    project: emptyProjectCommercial(),
    product: emptyProductCommercial(),
    score: null,
    scoreBreakdown: [],
    scoredAt: null,
  };
}

function norm(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function inCatalog(value: string, catalog: string[]): boolean {
  const n = norm(value);
  if (!n) return false;
  return catalog.some((item) => norm(item) === n);
}

function scoreSingle(
  value: string,
  catalog: string[],
  label: string,
  key: string
): QualificationScoreBreakdownItem | null {
  if (!String(value || '').trim()) return null;
  if (!catalog.length) {
    return {
      key,
      label,
      score: 0,
      detail: 'No admin catalog configured for this field',
    };
  }
  const matched = inCatalog(value, catalog);
  return {
    key,
    label,
    score: matched ? 100 : 0,
    detail: matched
      ? `"${value}" matches Qualification Match catalog`
      : `"${value}" is not in Qualification Match catalog`,
  };
}

function scoreMulti(
  selected: string[],
  catalog: string[],
  label: string,
  key: string
): QualificationScoreBreakdownItem | null {
  const items = (selected || []).map((s) => String(s || '').trim()).filter(Boolean);
  if (!items.length) return null;
  if (!catalog.length) {
    return {
      key,
      label,
      score: 0,
      detail: 'No admin catalog configured for this field',
    };
  }
  const matched = items.filter((item) => inCatalog(item, catalog));
  const score = Math.round((matched.length / items.length) * 100);
  return {
    key,
    label,
    score,
    detail: `${matched.length} of ${items.length} selected value(s) match catalog`,
  };
}

export function computeQualificationMatchScore(
  commercial: LeadCommercialRequirement | null | undefined,
  catalog: QualificationMatchCatalog | null | undefined
): { score: number | null; breakdown: QualificationScoreBreakdownItem[] } {
  const cat = catalog || DEFAULT_QUALIFICATION_MATCH_CATALOG;
  const kind = commercial?.kind || '';
  const breakdown: QualificationScoreBreakdownItem[] = [];

  if (kind === 'project' && commercial?.project) {
    const p = commercial.project;
    const parts = [
      scoreSingle(p.softwareType, cat.projectSoftwareTypes, 'Software type', 'softwareType'),
      scoreMulti(p.technologies, cat.projectTechnologies, 'Technologies', 'technologies'),
      scoreSingle(p.numberOfUsers, cat.projectUserBands, 'Number of users', 'numberOfUsers'),
      scoreMulti(p.integrations, cat.projectIntegrations, 'Integrations', 'integrations'),
    ];
    for (const part of parts) if (part) breakdown.push(part);
  } else if (kind === 'product' && commercial?.product) {
    const p = commercial.product;
    const parts = [
      scoreSingle(p.category, cat.productCategories, 'Product category', 'category'),
      scoreSingle(p.specification, cat.productSpecifications, 'Specification', 'specification'),
      scoreMulti(p.certifications, cat.productCertifications, 'Certifications', 'certifications'),
    ];
    for (const part of parts) if (part) breakdown.push(part);
  }

  if (!breakdown.length) return { score: null, breakdown: [] };
  const score = Math.round(
    breakdown.reduce((sum, item) => sum + item.score, 0) / breakdown.length
  );
  return { score, breakdown };
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return 'Not scored';
  if (score >= 80) return 'Strong match';
  if (score >= 55) return 'Partial match';
  if (score >= 30) return 'Weak match';
  return 'Poor match';
}
