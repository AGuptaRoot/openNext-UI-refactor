import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useActiveExtension } from '../../hooks/useActiveExtension';
import { ExtensionMount } from '../../components/extensions/ExtensionMount';
import { getExtensionIcon } from '../../components/extensions/extensionIcons';

export const ExtensionPage: React.FC = () => {
  const { extensionId, pageId } = useParams<{ extensionId: string; pageId: string }>();
  const { extension, declarations, canSeePage } = useActiveExtension();

  // 1. Validate active extension ID match
  if (extension.id !== extensionId) {
    return (
      <div className="py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-900">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Extension not active or not found
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          The requested extension <code className="text-zinc-700 dark:text-zinc-300 font-semibold">{extensionId}</code> is not currently active for this workspace. The active extension is <strong className="text-zinc-800 dark:text-zinc-200">{extension.name}</strong>.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold px-4 py-2 rounded-lg no-underline transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  // 2. Validate page declared in active extension
  const pageDef = declarations.navigation?.pages?.find((p) => p.id === pageId);

  if (!pageDef) {
    return (
      <div className="py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-700">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Page not found in this extension
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          The active extension <strong className="text-zinc-800 dark:text-zinc-200">{extension.name}</strong> does not declare a page with identifier <code className="text-zinc-700 dark:text-zinc-300 font-semibold">{pageId}</code>.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold px-4 py-2 rounded-lg no-underline transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  // 3. Validate user permission for this page
  if (!canSeePage(pageDef)) {
    return (
      <div className="py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-900">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Access Denied
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          You do not have permission to view this page. Required permission: <code className="text-rose-600 font-mono text-[11px]">{pageDef.permission || 'Restricted'}</code>.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold px-4 py-2 rounded-lg no-underline transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const title = (pageDef as any).title || pageDef.label;
  const description = (pageDef as any).description;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900 shadow-sm shrink-0">
            {getExtensionIcon(pageDef.icon, { className: 'h-5 w-5' })}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 self-start sm:self-auto border border-zinc-200 dark:border-zinc-700">
          <span>{extension.name}</span>
          <span>•</span>
          <span>v{extension.version || '1.0.0'}</span>
        </div>
      </div>

      {/* Extension Mount Area */}
      <ExtensionMount slot={pageDef.slot} />
    </div>
  );
};
export default ExtensionPage;
