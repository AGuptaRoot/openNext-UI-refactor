import type { QuotationTemplateItem } from '../types/quotations';

export const INITIAL_MOCK_QUOTATION_TEMPLATES: QuotationTemplateItem[] = [
  {
    _id: 'quotpl_1',
    name: 'Full Stack Web App Development Scope',
    category: 'Fixed Scope',
    description: 'Standard web application delivery package.',
    currency: 'INR',
    taxCalculation: 'after_discount',
    shippingCharge: 0,
    recipientNotes: '50% advance on signing, 50% on UAT sign-off.',
    terms: 'Includes 90-day complimentary defect warranty.',
    discountType: 'percent',
    discountValue: 0,
    lineItems: [
      {
        name: 'Discovery & UX',
        description: 'Workshops, wireframes, design system',
        qty: 1,
        rate: 80000,
        tax: 18,
      },
      {
        name: 'Full-stack development',
        description: 'API, admin, and client portals',
        qty: 1,
        rate: 250000,
        tax: 18,
      },
    ],
  },
  {
    _id: 'quotpl_2',
    name: 'Quarterly SEO Retainer',
    category: 'Retainers',
    description: 'Ongoing SEO and content package.',
    currency: 'INR',
    taxCalculation: 'after_discount',
    shippingCharge: 0,
    recipientNotes: 'Billed quarterly in advance.',
    discountType: 'percent',
    discountValue: 0,
    lineItems: [
      {
        name: 'SEO retainer (quarter)',
        description: 'Technical SEO, content, reporting',
        qty: 1,
        rate: 90000,
        tax: 18,
      },
    ],
  },
];
