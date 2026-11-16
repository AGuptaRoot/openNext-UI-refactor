import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSalesFlowConfig } from '../../hooks/useSalesFlowConfig';

/**
 * The quotation template pages, unless the active extension leaves quotation templates out
 * (salesFlow.hideQuotationTemplates): then an old link or a typed URL goes to the quotation list.
 * Stored templates are kept; they come back when an extension without the flag is active.
 */
export const QuotationTemplatesGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const salesFlow = useSalesFlowConfig();
  if (salesFlow.hideQuotationTemplates) return <Navigate to="/quotations" replace />;
  return <>{children}</>;
};
