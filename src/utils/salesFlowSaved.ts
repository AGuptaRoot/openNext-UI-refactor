import { crmApi } from '../services/api';

/**
 * Tells the active extension a sales record was saved (salesFlow.*Form.savedRoute), so it can
 * keep its own copy in step. Returns the reason when that did not work, else null.
 * Never throws: the record itself is already saved.
 */
export async function notifySalesFlowSaved(kind: 'opportunity' | 'quotation', id: string): Promise<string | null> {
  try {
    const res =
      kind === 'opportunity' ? await crmApi.salesFlowOpportunitySaved(id) : await crmApi.salesFlowQuotationSaved(id);
    if (res.data && res.data.ok === false) return res.data.message || 'The extension did not accept the record.';
    return null;
  } catch (err) {
    return err instanceof Error && err.message ? err.message : 'The extension could not be reached.';
  }
}
