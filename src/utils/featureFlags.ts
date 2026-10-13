/**
 * Product feature flags (mirrors openext-crm-suite ui/admin/utils/feature-flags.js).
 * Invoice collections are Razorpay-only after send — manual cash/bank entry is off.
 */
export const CrmFeatures = {
  /** Set true only if finance should record offline cash/bank payments. */
  allowManualPayments: false as boolean,

  isManualPaymentEnabled(): boolean {
    return this.allowManualPayments === true;
  },
};
