import React, { useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { TimerProvider } from './context/TimerContext';
import { DialogProvider } from './context/DialogContext';
import { Layout } from './components/Layout';
import { Guarded } from './components/auth/RequirePermission';
import { evaluateRouteAccess } from './utils/routeAccess';
import { DashboardPage } from './pages/dashboard';
import { LeadsPage, LeadCreatePage, LeadDetailPage } from './pages/leads';
import { ContactsPage, ContactCreatePage, ContactDetailPage } from './pages/contacts';
import { ReportsPage } from './pages/reports';
import { ClientsPage, ClientCreatePage, ClientDetailPage } from './pages/clients';
import { OpportunitiesPage, OpportunityCreatePage, OpportunityDetailPage } from './pages/opportunities';
import {
  ProjectsPage,
  ProjectCreatePage,
  ProjectEditPage,
  ProjectDetailPage,
} from './pages/projects';
import { TasksPage, TaskCreatePage, TaskDetailPage } from './pages/tasks';
import { TimeLogsPage } from './pages/time-logs';
import { ExpensesPage, ExpenseCreatePage, ExpenseDetailPage } from './pages/expenses';
import {
  QuotationsPage,
  QuotationCreatePage,
  QuotationDetailPage,
  QuotationTemplatesPage,
  QuotationTemplateCreatePage,
} from './pages/quotations';
import {
  InvoicesPage,
  InvoiceCreatePage,
  InvoiceDetailPage,
  InvoiceTemplatesPage,
  InvoiceTemplateCreatePage,
} from './pages/invoices';
import { PaymentsPage, PaymentCreatePage, PaymentDetailPage } from './pages/payments';
import { SalesOrdersPage, SalesOrderCreatePage, SalesOrderDetailPage } from './pages/sales-orders';
import { SamplesPage, SampleCreatePage, SampleRequestDetailPage } from './pages/samples';
import { AddOnsPage } from './pages/add-ons';
import { TicketsPage, TicketCreatePage, TicketDetailPage } from './pages/tickets';
import { CustomerSuccessPage } from './pages/customer-success';
import { MarketingPage } from './pages/marketing';
import { SettingsPage } from './pages/settings';
import { AuditPage } from './pages/audit';
import { DataQualityPage } from './pages/data-quality';
import { AnalyticsAiPage } from './pages/analytics-ai';

function resolveClientHomeRoute(): string {
  return '/projects';
}

function resolveBootstrapRoute(isClientUser = false): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const cmsPage = params.get('__cms_page');
    if (cmsPage && cmsPage !== 'dashboard') {
      return `/${cmsPage}`;
    }
    // Clients must never land on dashboard
    if (cmsPage === 'dashboard' && isClientUser) {
      return resolveClientHomeRoute();
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      const parentUrl = new URL(window.parent.location.href);
      const runtimePath = '/dashboard/plugins/runtime/openext-crm-suite';
      if (parentUrl.pathname.startsWith(runtimePath)) {
        const suffix = parentUrl.pathname.slice(runtimePath.length).replace(/^\/+/, '');
        const navId = suffix.split('/').filter(Boolean)[0];
        if (navId && navId !== 'dashboard') {
          return `/${decodeURIComponent(navId)}`;
        }
        if (navId === 'dashboard' && isClientUser) {
          return resolveClientHomeRoute();
        }
      }
    }
  } catch {
    // ignore
  }

  return isClientUser ? resolveClientHomeRoute() : '/dashboard';
}

/** Intelligent root redirect — falls back to dashboard (or projects for clients). */
const InitialRouteRedirect: React.FC = () => {
  const { loading, hasAnyPermission, isClient, activeRole } = useAuth();
  const targetRoute = useMemo(() => resolveBootstrapRoute(isClient), [isClient]);

  if (loading) {
    return <div className="py-24 text-center text-sm text-zinc-500">Loading…</div>;
  }

  const fallback = isClient ? resolveClientHomeRoute() : '/dashboard';
  const { allowed } = evaluateRouteAccess(targetRoute, { hasAnyPermission, isClient, activeRole });
  return <Navigate to={allowed ? targetRoute : fallback} replace />;
};

const UnmigratedRouteFallback: React.FC = () => {
  const location = useLocation();
  const rawSegment = location.pathname.replace(/^\/+/, '').split('/')[0] || '';
  if (rawSegment.toLowerCase() === 'ext') {
    return <Navigate to="/travel-requirement" replace />;
  }
  const formattedModule = rawSegment
    ? rawSegment
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Module';

  return (
    <div className="py-24 px-6 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mb-5 shadow-none">
        <InfoOutlinedIcon sx={{ fontSize: 28 }} />
      </div>
      <h2 className="text-2xl font-bold text-zinc-950 mb-2 tracking-tight">{formattedModule} Module</h2>
      <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
        No React page is registered for <strong>{formattedModule}</strong>. Use the sidebar to open a
        migrated CRM module, or return to the dashboard.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg no-underline"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        <span>Go to Dashboard</span>
      </Link>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
        <DialogProvider>
          <TimerProvider>
            <HashRouter>
              <Layout>
              <Routes>
              <Route path="/dashboard" element={<Guarded><DashboardPage /></Guarded>} />
              <Route path="/reports" element={<Guarded><ReportsPage /></Guarded>} />

              <Route path="/leads" element={<Guarded><LeadsPage /></Guarded>} />
              <Route path="/leads/create" element={<Guarded><LeadCreatePage /></Guarded>} />
              <Route path="/leads/:id" element={<Guarded><LeadDetailPage /></Guarded>} />

              <Route path="/contacts" element={<Guarded><ContactsPage /></Guarded>} />
              <Route path="/contacts/create" element={<Guarded><ContactCreatePage /></Guarded>} />
              <Route path="/contacts/:id" element={<Guarded><ContactDetailPage /></Guarded>} />

              <Route path="/clients" element={<Guarded><ClientsPage /></Guarded>} />
              <Route path="/clients/create" element={<Guarded><ClientCreatePage /></Guarded>} />
              <Route path="/clients/:id" element={<Guarded><ClientDetailPage /></Guarded>} />

              <Route path="/opportunities" element={<Guarded><OpportunitiesPage /></Guarded>} />
              <Route path="/opportunities/create" element={<Guarded><OpportunityCreatePage /></Guarded>} />
              <Route path="/opportunities/:id" element={<Guarded><OpportunityDetailPage /></Guarded>} />

              <Route path="/projects" element={<Guarded><ProjectsPage /></Guarded>} />
              <Route path="/projects/dropped" element={<Guarded><ProjectsPage /></Guarded>} />
              <Route path="/projects/create" element={<Guarded><ProjectCreatePage /></Guarded>} />
              <Route path="/projects/:id/edit" element={<Guarded><ProjectEditPage /></Guarded>} />
              <Route path="/projects/:id" element={<Guarded><ProjectDetailPage /></Guarded>} />

              <Route path="/tasks" element={<Guarded><TasksPage /></Guarded>} />
              <Route path="/tasks/create" element={<Guarded><TaskCreatePage /></Guarded>} />
              <Route path="/tasks/:id" element={<Guarded><TaskDetailPage /></Guarded>} />

              <Route path="/time-logs" element={<Guarded><TimeLogsPage /></Guarded>} />

              <Route path="/expenses" element={<Guarded><ExpensesPage /></Guarded>} />
              <Route path="/expenses/create" element={<Guarded><ExpenseCreatePage /></Guarded>} />
              <Route path="/expenses/:id" element={<Guarded><ExpenseDetailPage /></Guarded>} />

              <Route path="/quotations" element={<Guarded><QuotationsPage /></Guarded>} />
              <Route path="/quotations/create" element={<Guarded><QuotationCreatePage /></Guarded>} />
              <Route path="/quotations/:id" element={<Guarded><QuotationDetailPage /></Guarded>} />
              <Route path="/quotation-templates" element={<Guarded><QuotationTemplatesPage /></Guarded>} />
              <Route path="/quotation-templates/create" element={<Guarded><QuotationTemplateCreatePage /></Guarded>} />

              <Route path="/invoices" element={<Guarded><InvoicesPage /></Guarded>} />
              <Route path="/invoices/create" element={<Guarded><InvoiceCreatePage /></Guarded>} />
              <Route path="/invoices/:id" element={<Guarded><InvoiceDetailPage /></Guarded>} />
              <Route path="/invoice-templates" element={<Guarded><InvoiceTemplatesPage /></Guarded>} />
              <Route path="/invoice-templates/create" element={<Guarded><InvoiceTemplateCreatePage /></Guarded>} />

              <Route path="/payments" element={<Guarded><PaymentsPage /></Guarded>} />
              <Route path="/payments/create" element={<Guarded><PaymentCreatePage /></Guarded>} />
              <Route path="/payments/:id" element={<Guarded><PaymentDetailPage /></Guarded>} />

              <Route path="/sales-orders" element={<Guarded><SalesOrdersPage /></Guarded>} />
              <Route path="/sales-orders/create" element={<Guarded><SalesOrderCreatePage /></Guarded>} />
              <Route path="/sales-orders/:id" element={<Guarded><SalesOrderDetailPage /></Guarded>} />

              <Route path="/samples" element={<Guarded><SamplesPage /></Guarded>} />
              <Route path="/samples/create" element={<Guarded><SampleCreatePage /></Guarded>} />
              <Route path="/samples/:id" element={<Guarded><SampleRequestDetailPage /></Guarded>} />

              <Route path="/travel" element={<Guarded><AddOnsPage /></Guarded>} />
              <Route path="/travel-requirement" element={<Guarded><AddOnsPage /></Guarded>} />
              <Route path="/add-ons" element={<Guarded><AddOnsPage /></Guarded>} />
              <Route path="/ext/:extensionId/:pageId" element={<Guarded><AddOnsPage /></Guarded>} />
              <Route path="/ext/*" element={<Guarded><AddOnsPage /></Guarded>} />
              <Route path="/ext" element={<Guarded><AddOnsPage /></Guarded>} />
              <Route path="/tickets" element={<Guarded><TicketsPage /></Guarded>} />
              <Route path="/tickets/create" element={<Guarded><TicketCreatePage /></Guarded>} />
              <Route path="/tickets/:id" element={<Guarded><TicketDetailPage /></Guarded>} />

              <Route path="/customer-success" element={<Guarded><CustomerSuccessPage /></Guarded>} />
              <Route path="/marketing" element={<Guarded><MarketingPage /></Guarded>} />

              <Route path="/settings" element={<Guarded><SettingsPage /></Guarded>} />
              <Route path="/audit" element={<Guarded><AuditPage /></Guarded>} />
              <Route path="/data-quality" element={<Guarded><DataQualityPage /></Guarded>} />
              <Route path="/analytics-ai" element={<Guarded><AnalyticsAiPage /></Guarded>} />
              <Route path="/security" element={<Navigate to="/settings" replace />} />

              <Route path="/" element={<InitialRouteRedirect />} />
              <Route path="*" element={<UnmigratedRouteFallback />} />
            </Routes>
              </Layout>
            </HashRouter>
          </TimerProvider>
        </DialogProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
