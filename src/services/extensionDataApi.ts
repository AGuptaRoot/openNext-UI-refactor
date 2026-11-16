/**
 * Client for CRM workspace extension declared data & settings (Contract §3, §9).
 *
 * OWNER: Step 2 (agy).
 * Uses credentials: 'include' and the standard { success, data, error } envelope.
 */

const API_BASE = '/api/plugins/openext-crm-suite';

export interface ExtensionValuesResponse {
  extensionId: string;
  values: Record<string, unknown>;
}

export interface ExtensionSettingsResponse {
  extensionId: string;
  tab: {
    label: string;
    icon: string;
    description: string;
    fieldCount?: number;
    eyebrow?: string;
    slot?: string;
  } | null;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    helpText?: string;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    default?: unknown;
    min?: number;
    max?: number;
  }>;
  values: Record<string, unknown>;
}

export interface ExtensionModelListResponse<T = Record<string, unknown>> {
  items: T[];
  total: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const message = body.error || `Extension API error (${res.status})`;
    const error = new Error(message) as Error & { status?: number; code?: string; details?: unknown };
    error.status = res.status;
    error.code = body.code;
    error.details = body.details;
    throw error;
  }

  return body.data as T;
}

export const extensionDataApi = {
  /**
   * GET /crm-extension-data/values/:record/:recordId
   * Reads declared field values for the active extension on a core record.
   */
  async getValues(record: string, recordId: string): Promise<ExtensionValuesResponse> {
    return request<ExtensionValuesResponse>(
      `/crm-extension-data/values/${encodeURIComponent(record)}/${encodeURIComponent(recordId)}`
    );
  },

  /**
   * PUT /crm-extension-data/values/:record/:recordId
   * Validates and saves declared field values for the active extension.
   */
  async setValues(
    record: string,
    recordId: string,
    values: Record<string, unknown>
  ): Promise<ExtensionValuesResponse> {
    return request<ExtensionValuesResponse>(
      `/crm-extension-data/values/${encodeURIComponent(record)}/${encodeURIComponent(recordId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ values }),
      }
    );
  },

  /**
   * GET /crm-extension-data/settings
   * Loads the active extension's settings form fields and current values.
   */
  async getSettings(): Promise<ExtensionSettingsResponse> {
    return request<ExtensionSettingsResponse>('/crm-extension-data/settings');
  },

  /**
   * PUT /crm-extension-data/settings
   * Saves settings for the active extension.
   */
  async setSettings(values: Record<string, unknown>): Promise<ExtensionValuesResponse> {
    return request<ExtensionValuesResponse>('/crm-extension-data/settings', {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  },

  /**
   * Contract §9 generic JSON-model list query.
   * e.g. GET /x/<id>/_models/<Model>?leadId=<recordId>
   */
  async getModelRows<T = Record<string, unknown>>(
    apiBase: string,
    model: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<ExtensionModelListResponse<T>> {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        search.set(k, String(v));
      }
    }
    const queryStr = search.toString();
    const endpoint = `${apiBase}/_models/${encodeURIComponent(model)}${queryStr ? `?${queryStr}` : ''}`;
    return request<ExtensionModelListResponse<T>>(endpoint);
  },

  /**
   * Contract §9 create model row.
   */
  async createModelRow<T = Record<string, unknown>>(
    apiBase: string,
    model: string,
    data: unknown
  ): Promise<T> {
    return request<T>(`${apiBase}/_models/${encodeURIComponent(model)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Contract §9 update model row.
   */
  async updateModelRow<T = Record<string, unknown>>(
    apiBase: string,
    model: string,
    rowId: string,
    data: unknown
  ): Promise<T> {
    return request<T>(`${apiBase}/_models/${encodeURIComponent(model)}/${encodeURIComponent(rowId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Contract §9 delete model row.
   */
  async deleteModelRow(apiBase: string, model: string, rowId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(
      `${apiBase}/_models/${encodeURIComponent(model)}/${encodeURIComponent(rowId)}`,
      {
        method: 'DELETE',
      }
    );
  },
};
