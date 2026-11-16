import type { SalesFlowConfig } from '../types/leads';

/**
 * Wording and switches the active extension sets for the opportunity and quotation pages
 * (manifest salesFlow.terms, hideShipping, lockOpportunityContact). Without an extension the
 * CRM's own product-sales wording is used.
 */
export interface SalesTerms {
  /** Plural noun for the lines, e.g. "Products" / "Travel Services". */
  lines: string;
  /** Column / singular, e.g. "Product / Service" / "Travel Service". */
  line: string;
  /** Opportunity section, e.g. "Proposed Products & Line Items" / "Proposed Travel Services". */
  proposedLines: string;
  /** Subtotal label, e.g. "Products subtotal" / "Service Subtotal". */
  subtotal: string;
  /** Money section, e.g. "Shipping & financials" / "Commercial Summary". */
  commercialSummary: string;
  /** Services, not goods: no shipping charge, no shipping wording. */
  hideShipping: boolean;
  /** The opportunity's primary contact is fixed after creation (correction by admin / manager only). */
  lockOpportunityContact: boolean;
}

export function salesTerms(flow: SalesFlowConfig | null | undefined): SalesTerms {
  const t = (flow && flow.terms) || {};
  return {
    lines: t.lines || 'Products',
    line: t.line || 'Product / Service',
    proposedLines: t.proposedLines || 'Proposed Products & Line Items',
    subtotal: t.subtotal || 'Products subtotal',
    commercialSummary: t.commercialSummary || 'Shipping & financials',
    hideShipping: Boolean(flow && flow.hideShipping),
    lockOpportunityContact: Boolean(flow && flow.lockOpportunityContact),
  };
}
