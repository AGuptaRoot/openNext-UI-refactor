import React, { useEffect } from 'react';
import { applyDocumentTheme, useTheme } from '@/context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDashboardSidebarSync, hideParentSidebarRoutes } from '../hooks/useDashboardSidebarSync';
import { CheckoutNoteModal } from './common/CheckoutNoteModal';
import { ActivityReminderPopup } from './common/ActivityReminderPopup';
import { ModuleTour } from '../tours/ModuleTour';
import { LeadsTour } from '../tours/LeadsTour';
import { ClientsTour } from '../tours/ClientsTour';
import { ContactsTour } from '../tours/ContactsTour';
import { ProjectsTour } from '../tours/ProjectsTour';
import { TasksTour } from '../tours/TasksTour';
import { TimeLogsTour } from '../tours/TimeLogsTour';
import { QuotationsTour } from '../tours/QuotationsTour';
import { InvoicesTour } from '../tours/InvoicesTour';
import { ExpensesTour } from '../tours/ExpensesTour';
import { DataQualityTour } from '../tours/DataQualityTour';
import { SalesOrdersTour } from '../tours/SalesOrdersTour';
import { SamplesTour } from '../tours/SamplesTour';
import { OpportunitiesTour } from '../tours/OpportunitiesTour';
import { TicketsTour } from '../tours/TicketsTour';
import { CustomerSuccessTour } from '../tours/CustomerSuccessTour';
import { MarketingTour } from '../tours/MarketingTour';
import { AuditTour } from '../tours/AuditTour';
import { SettingsTour } from '../tours/SettingsTour';
import { DashboardTour } from '../tours/DashboardTour';
import { ReportsTour } from '../tours/ReportsTour';
import { TourControlBar } from '../tours/TourControlBar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const { activeRole, isClient, canUseTours } = useAuth();
  useDashboardSidebarSync();

  /*
   * Keep Tailwind `dark:` utilities in sync with the OpenNext CMS theme.
   *
   * `applyDocumentTheme` writes to whichever elements the CRM owns: the mount
   * roots when hosted in the dashboard (its stylesheet is scoped to them, and
   * <html> is the CMS's to control), or the document when standalone.
   */
  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  // Client: hide Dashboard. Employee: hide Expenses.
  // Travel extension pages: hide internal/legacy sub-pages and duplicate 'travel' link from sidebar; keep "Travel requirement" visible for Admin/Managers.
  useEffect(() => {
    const hideIds: string[] = ['travel'];
    const hideLabels = [
      'Travel',
      'Travel Lead Form',
      'Travel Lead View',
      'Travel Settings',
      'Host Slots',
    ];
    if (isClient) {
      hideIds.push('dashboard', 'travel-requirement');
      hideLabels.push('Travel Requirement', 'Travel requirement');
    }
    const role = String(activeRole || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    if (role === 'crm-employee' || role === 'employee' || role === 'freelancer' || role === '104') {
      hideIds.push('expenses');
    }
    const apply = () => hideParentSidebarRoutes(hideIds, undefined, hideLabels);
    apply();
    const timer = window.setInterval(apply, 500);
    return () => window.clearInterval(timer);
  }, [isClient, activeRole]);



  return (
    <div
      className={`min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 flex flex-col font-sans transition-colors ${
        theme === 'dark' ? 'dark' : ''
      }`}
      data-theme={theme}
    >
      {canUseTours && (
        <>
          <ModuleTour />
          <LeadsTour />
          <ClientsTour />
          <ContactsTour />
          <ProjectsTour />
          <TasksTour />
          <TimeLogsTour />
          <QuotationsTour />
          <InvoicesTour />
          <ExpensesTour />
          <DataQualityTour />
          <SalesOrdersTour />
          <SamplesTour />
          <OpportunitiesTour />
          <TicketsTour />
          <CustomerSuccessTour />
          <MarketingTour />
          <AuditTour />
          <SettingsTour />
          <DashboardTour />
          <ReportsTour />
        </>
      )}

      <div className="sticky top-0 z-[60]">
        {canUseTours && <TourControlBar />}

        {/* Top Navbar */}
        {/* <header
          data-tour="crm-header"
          className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4"
        > */}
        {/* Left: Brand & Home Link */}
        {/* <div className="flex items-center gap-3 shrink-0">
          <Link to={homePath} className="flex items-center gap-3 no-underline">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-bold text-sm select-none">
              <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
            </div>
            <div>
              <h1 className="text-[14px] font-bold text-zinc-950 dark:text-zinc-50 leading-tight tracking-tight m-0">
                Root CRM
              </h1>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 m-0 leading-none mt-0.5">
                {tenantName}
              </p>
            </div>
          </Link>
        </div> */}

        {/* Center: Global Search Bar (RBAC-Based) */}
        {/* <div data-tour="crm-search" className="flex-1 min-w-0 max-w-xl mx-auto">
          <GlobalSearchBar />
        </div> */}

        {/* Right Area: Active Task Timer & User Profile */}
        {/* <div className="flex items-center gap-3 shrink-0">
          <div data-tour="crm-timer">
            <NavbarTimer />
          </div> */}

          {/* User Profile & Role Info */}
          {/* <div className="flex items-center gap-2 pl-1 sm:pl-2 sm:border-l sm:border-zinc-200 dark:sm:border-zinc-800">
            <div className="w-8 h-8 rounded-full bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center text-xs font-semibold select-none">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 leading-tight">
                {displayName}
              </div>
              <span className="inline-block text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 mt-0.5">
                {activeRole}
              </span>
            </div>
          </div> */}
        {/* </div> */}
      {/* </header> */}
      </div>

      {/* Main Content Area */}
      <main
        data-tour="crm-main"
        className="box-border w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8 mx-auto"
      >
        {children}
      </main>

      {/* Global Check-Out Work Note Modal */}
      <CheckoutNoteModal />

      {/* Hourly reminder for the activities assigned to this user */}
      <ActivityReminderPopup />
    </div>
  );
};
