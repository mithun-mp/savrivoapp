import type { ApiResponse } from '@/types';

const isProd = import.meta.env.PROD;
const DEFAULT_API = isProd ? 'https://savrivo-api.onrender.com/api' : 'http://localhost:4000/api';
export const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.PUBLIC_API_URL || DEFAULT_API;

async function apiRequest<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs || 10000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiResponse;
      let errMsg = err.error?.message || `Request failed: ${res.status}`;
      if (Array.isArray(err.error?.details) && err.error.details.length > 0) {
        const details = err.error.details
          .map((d: any) => (d.field ? `${d.field}: ${d.message}` : d.message || JSON.stringify(d)))
          .join(', ');
        errMsg = `${errMsg} (${details})`;
      }
      throw new Error(errMsg);
    }
    return res.json() as Promise<ApiResponse<T>>;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function authHeaders(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  const token = localStorage.getItem('savrivo-admin-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  products: {
    list: (params = '') => apiRequest<unknown[]>(`/products${params ? `?${params}` : ''}`),
    get: (slug: string) => apiRequest<unknown>(`/products/${slug}`),
    refresh: (slug: string) => apiRequest<unknown>(`/products/${slug}/refresh`, { method: 'POST' }),
  },
  click: {
    getUrl: (offerId: string, campaign?: string) =>
      `${API_BASE}/click/${offerId}${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ''}`,
    track: (offerId: string, campaign?: string) =>
      apiRequest<{ targetUrl: string }>('/click/track', {
        method: 'POST',
        body: JSON.stringify({ offerId, campaign }),
      }),
  },
  categories: {
    list: () => apiRequest<unknown[]>('/categories'),
    get: (slug: string) => apiRequest<unknown>(`/categories/${slug}`),
  },
  guides: {
    list: (params = '') => apiRequest<unknown[]>(`/guides${params ? `?${params}` : ''}`),
    get: (slug: string) => apiRequest<unknown>(`/guides/${slug}`),
  },
  merchants: {
    list: () => apiRequest<unknown[]>('/merchants'),
  },
  search: {
    query: (q: string) => apiRequest<unknown>(`/search?q=${encodeURIComponent(q)}`),
  },
  health: () => apiRequest<unknown>('/health'),

  // Admin endpoints (require auth)
  admin: {
    login: (email: string, password: string) =>
      apiRequest<{ token: string; user: { email: string; role: string } }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => apiRequest('/admin/auth/logout', {
      method: 'POST',
      headers: authHeaders(),
    }),
    dashboard: () => apiRequest<unknown>('/admin/dashboard', { headers: authHeaders() }),

    products: {
      list: (params = '') => apiRequest<unknown[]>(`/admin/products${params ? `?${params}` : ''}`, { headers: authHeaders() }),
      get: (id: string) => apiRequest<unknown>(`/admin/products/${id}`, { headers: authHeaders() }),
      create: (data: unknown) => apiRequest<unknown>('/admin/products', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      update: (id: string, data: unknown) => apiRequest<unknown>(`/admin/products/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), headers: authHeaders(),
      }),
      delete: (id: string) => apiRequest<unknown>(`/admin/products/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      }),
    },

    categories: {
      list: () => apiRequest<unknown[]>('/admin/categories', { headers: authHeaders() }),
      get: (id: string) => apiRequest<unknown>(`/admin/categories/${id}`, { headers: authHeaders() }),
      create: (data: unknown) => apiRequest<unknown>('/admin/categories', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      update: (id: string, data: unknown) => apiRequest<unknown>(`/admin/categories/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), headers: authHeaders(),
      }),
      delete: (id: string) => apiRequest<unknown>(`/admin/categories/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      }),
    },

    merchants: {
      list: () => apiRequest<unknown[]>('/admin/merchants', { headers: authHeaders() }),
      get: (id: string) => apiRequest<unknown>(`/admin/merchants/${id}`, { headers: authHeaders() }),
      create: (data: unknown) => apiRequest<unknown>('/admin/merchants', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      update: (id: string, data: unknown) => apiRequest<unknown>(`/admin/merchants/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), headers: authHeaders(),
      }),
      delete: (id: string) => apiRequest<unknown>(`/admin/merchants/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      }),
      toggle: (id: string) => apiRequest<unknown>(`/admin/merchants/${id}/toggle`, {
        method: 'POST', headers: authHeaders(),
      }),
    },

    offers: {
      list: (params = '') => apiRequest<unknown[]>(`/admin/offers${params ? `?${params}` : ''}`, { headers: authHeaders() }),
      get: (id: string) => apiRequest<unknown>(`/admin/offers/${id}`, { headers: authHeaders() }),
      create: (data: unknown) => apiRequest<unknown>('/admin/offers', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      update: (id: string, data: unknown) => apiRequest<unknown>(`/admin/offers/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), headers: authHeaders(),
      }),
      delete: (id: string) => apiRequest<unknown>(`/admin/offers/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      }),
      expire: (id: string) => apiRequest<unknown>(`/admin/offers/${id}/expire`, {
        method: 'POST', headers: authHeaders(),
      }),
      refresh: (id: string) => apiRequest<unknown>(`/admin/offers/${id}/refresh`, {
        method: 'POST', headers: authHeaders(),
      }),
    },

    guides: {
      list: (params = '') => apiRequest<unknown[]>(`/admin/guides${params ? `?${params}` : ''}`, { headers: authHeaders() }),
      get: (id: string) => apiRequest<unknown>(`/admin/guides/${id}`, { headers: authHeaders() }),
      create: (data: unknown) => apiRequest<unknown>('/admin/guides', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      update: (id: string, data: unknown) => apiRequest<unknown>(`/admin/guides/${id}`, {
        method: 'PATCH', body: JSON.stringify(data), headers: authHeaders(),
      }),
      delete: (id: string) => apiRequest<unknown>(`/admin/guides/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      }),
    },

    settings: {
      get: () => apiRequest<unknown>('/admin/settings', { headers: authHeaders() }),
      update: (data: unknown) => apiRequest<unknown>('/admin/settings', {
        method: 'PATCH', body: JSON.stringify(data), headers: authHeaders(),
      }),
    },

    productImport: {
      preview: (url: string) => apiRequest<unknown>('/admin/product-import/preview', {
        method: 'POST', body: JSON.stringify({ url }), headers: authHeaders(), timeoutMs: 30000,
      }),
      bulkPreview: (urls: string[]) => apiRequest<unknown[]>('/admin/product-import/bulk-preview', {
        method: 'POST', body: JSON.stringify({ urls }), headers: authHeaders(), timeoutMs: 45000,
      }),
      saveDraft: (data: unknown) => apiRequest<unknown>('/admin/product-import/save-draft', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      publish: (data: unknown) => apiRequest<unknown>('/admin/product-import/publish', {
        method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
      }),
      diagnostics: () => apiRequest<unknown>('/admin/product-import/diagnostics', {
        headers: authHeaders(),
      }),
    },
  },
};

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(dateStr));
}
