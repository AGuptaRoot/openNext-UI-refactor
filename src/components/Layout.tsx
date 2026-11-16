import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Puzzle } from 'lucide-react';
import { applyDocumentTheme, useTheme } from '@/context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useActiveExtension } from '../hooks/useActiveExtension';
import { useDashboardSidebarSync, hideParentSidebarRoutes } from '../hooks/useDashboardSidebarSync';
import { getExtensionIcon, getExtensionIconSvg } from './extensions/extensionIcons';
import { notifyHostNavChanged, syncParentSidebarExtensionPages } from '../utils/cmsSidebarExtensionPages';
import { removeSidebarSettingsNav, syncSidebarSettingsNav } from '../utils/cmsSidebarSettingsNav';
import { syncSidebarCrmIcons } from '../utils/cmsSidebarCrmIcons';
import { useExtensions } from '../hooks/useExtensions';
import { useSettingsTabGroups } from '../pages/settings/SettingsPage';
import { CheckoutNoteModal } from './common/CheckoutNoteModal';
import { ActivityReminderPopup } from './common/ActivityReminderPopup';
import { NotificationBell } from './common/NotificationBell';
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

/** Sidebar labels for the core modules a CRM extension can hide (matched by text, too). */
const EXTENSION_MODULE_LABELS: Record<string, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  'time-logs': 'Time Logs',
  'sales-orders': 'Sales Orders',
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const { activeRole, isClient, canUseTours, features, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { declarations, canSeePage, isProduct, isProject, extension } = useActiveExtension();
  useDashboardSidebarSync();

  const extensionPages = useMemo(() => {
    if (isProduct || isProject) return [];
    return (declarations.navigation?.pages || []).filter((page) => page.showInSidebar !== false && canSeePage(page));
  }, [isProduct, isProject, declarations.navigation?.pages, canSeePage]);

  useEffect(() => {
    const apply = () => {
      syncParentSidebarExtensionPages(extensionPages, extension.id, location.pathname, (p) => navigate(p), getExtensionIconSvg);
    };
    apply();
    // The CMS re-renders its sidebar (expand/collapse, navigation); re-apply shortly after.
    const timer = window.setInterval(apply, 1000);
    return () => {
      window.clearInterval(timer);
      syncParentSidebarExtensionPages([], extension.id, '', () => {}, getExtensionIconSvg);
    };
  }, [extensionPages, extension.id, navigate, location.pathname]);

  /*
   * CMS sidebar: the CRM's own icon per module, and the Settings sections as a
   * sub-menu of the Settings link (arrow to open / close; opens by itself on
   * the Settings page).
   */
  const { settingsTabs } = useExtensions();
  const { allTabGroups } = useSettingsTabGroups(settingsTabs);
  const canManageSettings = hasPermission('crm.settings.manage');
  const settingsGroups = useMemo(
    () =>
      canManageSettings
        ? allTabGroups.map((group) => ({
            groupId: group.groupId,
            title: group.title,
            tabs: group.tabs.map((tab) => ({ id: String(tab.id), label: tab.label })),
          }))
        : [],
    [allTabGroups, canManageSettings]
  );
  const onSettingsPage = location.pathname.replace(/\/+$/, '') === '/settings';
  const activeSettingsTab = onSettingsPage ? new URLSearchParams(location.search).get('tab') || 'general' : '';
  const [settingsNavOpen, setSettingsNavOpen] = useState(onSettingsPage);
  useEffect(() => {
    if (onSettingsPage) setSettingsNavOpen(true);
  }, [onSettingsPage]);

  useEffect(() => {
    const apply = () => {
      syncSidebarCrmIcons();
      syncSidebarSettingsNav({
        groups: settingsGroups,
        activeTab: activeSettingsTab,
        expanded: settingsNavOpen,
        onSelect: (tabId) => navigate(`/settings?tab=${encodeURIComponent(tabId)}`),
        onToggle: () => setSettingsNavOpen((open) => !open),
      });
    };
    apply();
    // The CMS re-renders its sidebar (expand/collapse, navigation); re-apply shortly after.
    const timer = window.setInterval(apply, 1000);
    return () => window.clearInterval(timer);
  }, [settingsGroups, activeSettingsTab, settingsNavOpen, navigate]);
  useEffect(() => () => removeSidebarSettingsNav(), []);

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

  /*
   * CRM 3.50.0: the CMS draws the CRM menu from GET /admin-nav (active extension + role + permissions),
   * loaded with the dashboard. When what decides it changes here (extension switched, modules toggled,
   * another role), ask the CMS to load it again — the CRM never waits for a page click to fix the menu.
   */
  const navKey = JSON.stringify([
    features?.activeExtension?.id || '',
    features?.activeExtension?.hiddenModules || [],
    features?.modules || {},
    activeRole || '',
    Boolean(isClient),
  ]);
  const lastNavKey = React.useRef('');
  useEffect(() => {
    if (!features) return;
    if (lastNavKey.current && lastNavKey.current !== navKey) notifyHostNavChanged();
    lastNavKey.current = navKey;
  }, [navKey, features]);

  // Client: hide Dashboard. Employee: hide Expenses.
  useEffect(() => {
    const hideIds: string[] = [];
    const hideLabels = ['Host Slots'];
    if (isClient) {
      hideIds.push('dashboard');
    }
    const role = String(activeRole || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    if (role === 'crm-employee' || role === 'employee' || role === 'freelancer' || role === '104') {
      hideIds.push('expenses');
    }

    // Optional module switches (Settings → Modules) - disabled by default
    const modules = features?.modules;
    if (!modules?.expenses) {
      hideIds.push('expenses');
      hideLabels.push('Expenses');
    }
    if (!modules?.marketing) {
      hideIds.push('marketing');
      hideLabels.push('Marketing', 'Marketing Automation');
    }
    if (!modules?.customerSuccess) {
      hideIds.push('customer-success');
      hideLabels.push('Customer Success');
    }
    if (!modules?.dataQuality) {
      hideIds.push('data-quality');
      hideLabels.push('Data Quality');
    }

    // Core modules the active CRM extension (Settings → Extensions) leaves out:
    // Product Sales hides Projects/Tasks/Time Logs, Project Delivery hides Sales Orders.
    // adminNav "extension" exists only so the CMS opens extension-page URLs; it is never a menu item
    // (the CMS hides it through GET /admin-nav; this covers a sidebar drawn before that answer).
    hideIds.push('extension');

    for (const routeId of features?.activeExtension?.hiddenModules || []) {
      hideIds.push(routeId);
      const label = EXTENSION_MODULE_LABELS[routeId];
      if (label) hideLabels.push(label);
    }

    const apply = () => hideParentSidebarRoutes(hideIds, undefined, hideLabels);
    apply();
    // The host re-renders its sidebar (navigation, expand / collapse): re-apply in the same task, so a
    // hidden item is never painted. Only childList changes are watched — apply() changes attributes
    // only, so it cannot trigger itself. A slow interval stays as a fallback.
    let observer: MutationObserver | null = null;
    try {
      const hostDoc = window.parent && window.parent !== window ? window.parent.document : document;
      const target = hostDoc.querySelector('nav') || hostDoc.querySelector('aside') || hostDoc.body;
      if (target && typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(apply);
        observer.observe(target, { childList: true, subtree: true });
      }
    } catch {
      // cross-origin host: the interval below still applies
    }
    const timer = window.setInterval(apply, 2000);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, [isClient, activeRole, features]);



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

      {/* Extension Navigation Group Strip (for standalone & top-level access); staff also get the
          notification bell at its right end (CRM 3.33.0). */}
      {(extensionPages.length > 0 || !isClient) && (
        <div
          data-crm-extension-nav="true"
          className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {extensionPages.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-2 shrink-0">
            <Puzzle className="h-3.5 w-3.5 text-blue-600" />
            <span>Extension</span>
          </div>
          ) : null}
          {extensionPages.map((page) => {
            const targetPath = `/ext/${extension.id}/${page.id}`;
            const isActive = location.pathname === targetPath;
            return (
              <Link
                key={page.id}
                to={targetPath}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors no-underline ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {getExtensionIcon(page.icon, { className: 'h-3.5 w-3.5' })}
                <span>{page.label}</span>
              </Link>
            );
          })}
          </div>
          {!isClient ? <NotificationBell /> : null}
        </div>
      )}

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
