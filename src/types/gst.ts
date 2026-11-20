/** GST suite (CRM 3.53.0): Settings → GST and client GST fields. */

/** GST portal rates (same list as the server's gst-core GST_PORTAL_RATES). */
export const GST_PORTAL_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40] as const;

export interface GstServiceTax {
  serviceType: string;
  label: string;
  sac: string;
  taxPercent: number;
  note: string;
  /** '' = typed by the admin; else the extension id it was loaded from. */
  source: string;
}

export interface GstTcsSlab {
  /** Upper limit in rupees; null = no upper limit. */
  upTo: number | null;
  rate: number;
}

export interface GstTcsRule {
  key: string;
  label: string;
  source: string;
  enabled: boolean;
  needsPan: boolean;
  sectionLabel: string;
  slabs: GstTcsSlab[];
  noPanRate: number | null;
}

export interface GstSettings {
  exists: boolean;
  legalName: string;
  tradeName: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  pan: string;
  compositionScheme: boolean;
  email: string;
  phone: string;
  address: { line1: string; line2: string; city: string; pincode: string };
  upiId: string;
  lut: { number: string; fy: string };
  serviceTaxes: GstServiceTax[];
  tcsRules: GstTcsRule[];
  lockedUpTo: string;
  defaultTerms: string;
  updatedAt?: string | null;
}

export interface GstExtensionInfo {
  extensionId: string;
  extensionName: string;
  services: number;
  tcsRules: number;
}

export interface GstSettingsResponse {
  settings: GstSettings;
  extension: GstExtensionInfo;
}

export interface GstSaveResult {
  settings: GstSettings;
  warnings: string[];
}

export interface GstSeedResult {
  extensionId: string;
  extensionName?: string;
  addedServices: number;
  addedTcsRules: number;
  message: string;
  settings: GstSettings;
}

export interface GstinCheck {
  ok: boolean;
  message: string;
  gstin?: string;
  stateCode?: string;
  state?: string;
  pan?: string;
  entityType?: string | null;
  taxpayerType?: string | null;
  checksumOk?: boolean;
}

/** GST details on a client (Company). gstin '' = unregistered (B2C). */
export interface ClientGstDetails {
  gstin: string;
  /** PAN from the GSTIN ('' when the PAN was typed: then only panLast4 is sent). */
  pan: string;
  /** CRM 3.54.0: last 4 of the PAN (shown as XXXXXX1234). */
  panLast4?: string;
  /** '' | 'gstin' | 'typed' */
  panSource?: string;
  isSEZ: boolean;
  isDeemedExport: boolean;
}
