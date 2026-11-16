import React from 'react';
import { Eye } from 'lucide-react';
import { ExtensionFieldsSection } from './ExtensionFieldsSection';
import { ExtensionMount } from './ExtensionMount';
import { ExtensionRecordsTab } from './ExtensionRecordsTab';
import type { ExtensionTabDef, ExtensionRecordType } from '../../types/extensions';

interface ExtensionTabContentProps {
  tab: ExtensionTabDef;
  record: ExtensionRecordType;
  recordId: string;
  recordData?: any;
  requestTypeKey?: string;
  /** The record is locked (e.g. a Won lead): fields and extension views are view-only. */
  readOnly?: boolean;
}

function resolveDottedPath(obj: any, path?: string): any {
  if (!path || !obj) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[p];
  }
  return curr;
}

export const ExtensionTabContent: React.FC<ExtensionTabContentProps> = ({
  tab,
  record,
  recordId,
  recordData,
  requestTypeKey,
  readOnly = false,
}) => {
  switch (tab.kind) {
    case 'fields':
      return (
        <ExtensionFieldsSection
          record={record}
          recordId={recordId}
          requestTypeKey={requestTypeKey}
          groupId={tab.fields}
          readOnly={readOnly}
        />
      );

    case 'readonly': {
      const scope = { [record]: recordData, ...recordData };
      const resolved = resolveDottedPath(scope, tab.source);

      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <Eye className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tab.label}</h3>
          </div>

          {resolved && typeof resolved === 'object' && Object.keys(resolved).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(resolved).map(([k, v]) => (
                <div key={k} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">{k}</div>
                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 break-words">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-zinc-400">
              No data available for source path: <code className="text-zinc-600 dark:text-zinc-300">{tab.source || 'n/a'}</code>
            </div>
          )}
        </div>
      );
    }

    case 'records':
      return <ExtensionRecordsTab tab={tab} record={record} recordId={recordId} />;

    case 'mount':
      return (
        <ExtensionMount
          slot={tab.slot || 'tab'}
          record={{ type: record, id: recordId, data: recordData }}
          readOnly={readOnly}
        />
      );

    default:
      return null;
  }
};
