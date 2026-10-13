import React from 'react';
import { Link } from 'react-router-dom';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ClientItem, ClientPaginationMeta } from '../../types/clients';
import { resolveClientAvatarColor, resolveClientMediaUrl } from '../../utils/clientAvatar';
import { formatClientAddressLine } from '../../utils/clientAddress';

interface ClientListViewProps {
  clients: ClientItem[];
  pagination: ClientPaginationMeta | null;
  onPageChange: (page: number) => void;
  onView: (client: ClientItem) => void;
  onDelete: (client: ClientItem) => void;
  canWrite: boolean;
  canDelete: boolean;
}

export const ClientListView: React.FC<ClientListViewProps> = ({
  clients,
  pagination,
  onPageChange,
  onView,
  onDelete,
  canWrite,
  canDelete,
}) => {
  if (clients.length === 0) {
    return (
      <div className="bg-white border border-zinc-300 rounded-xl p-12 text-center">
        <p className="text-sm font-semibold text-zinc-900 m-0 mb-1">No clients found</p>
        <p className="text-xs text-zinc-500 m-0">Adjust filters or create a new client account.</p>
      </div>
    );
  }

  const colTour: Record<string, string> = {
    Company: 'clients-col-company',
    Category: 'clients-col-category',
    Status: 'clients-col-status',
    'Tax ID': 'clients-col-tax-id',
    'Source Lead': 'clients-col-source-lead',
    'Primary Contact': 'clients-col-primary-contact',
    'Contact Info': 'clients-col-contact-info',
    Tags: 'clients-col-tags',
    Actions: 'clients-col-actions',
  };

  return (
    <div data-tour="clients-table" className="bg-white border border-zinc-300 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {[
                'Company',
                'Category',
                'Status',
                'Tax ID',
                'Source Lead',
                'Primary Contact',
                'Contact Info',
                'Tags',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  data-tour={colTour[h]}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client, rowIdx) => {
              const leadId = client.leadId || client.sourceLead?._id;
              const leadLabel =
                client.sourceLead?.name ||
                client.sourceLead?.company ||
                (leadId ? leadId : null);
              return (
                <tr
                  key={client._id}
                  data-client-id={client._id}
                  {...(rowIdx === 0 ? { 'data-tour': 'clients-row-first' } : {})}
                  className="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onView(client)}
                      className="flex items-center gap-3 bg-transparent border-none cursor-pointer p-0 text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-lg text-white flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden"
                        style={{ backgroundColor: resolveClientAvatarColor(client.avatarColor) }}
                      >
                        {client.avatarUrl ? (
                          <img
                            src={resolveClientMediaUrl(client.avatarUrl)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                              if (sibling) sibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span
                          className="w-full h-full items-center justify-center"
                          style={{ display: client.avatarUrl ? 'none' : 'flex' }}
                        >
                          {(client.name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-950">{client.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {formatClientAddressLine(client) || '—'}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">{client.category || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded border ${
                        client.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {client.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 font-mono">
                    {client.taxId || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {leadId ? (
                      <Link
                        to={`/leads/${leadId}`}
                        className="text-zinc-800 font-semibold no-underline hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {leadLabel}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    {client.primaryContact?.name || '—'}
                    {client.contactCount ? (
                      <span className="text-zinc-400 ml-1">({client.contactCount})</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    <div>{client.email || '—'}</div>
                    <div className="text-zinc-400">{client.phone || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(client.tags || []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="View"
                        onClick={() => onView(client)}
                        className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center cursor-pointer"
                      >
                        <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => onDelete(client)}
                          className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-red-50 text-red-600 flex items-center justify-center cursor-pointer"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </button>
                      )}
                      {!canWrite && !canDelete ? (
                        <span className="text-[11px] text-zinc-400 px-1">View only</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50">
          <span className="text-xs text-zinc-500">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} clients
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="w-8 h-8 rounded-lg border border-zinc-300 bg-white disabled:opacity-40 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="w-8 h-8 rounded-lg border border-zinc-300 bg-white disabled:opacity-40 flex items-center justify-center cursor-pointer"
            >
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
