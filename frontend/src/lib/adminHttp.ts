/**
 * HTTP Client for Admin API calls
 * - Adds X-Admin-Key header from sessionStorage
 * - Includes credentials (cookies)
 * - Handles errors with status + body
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ADMIN_KEY_STORAGE = 'tohome_admin_key';

export class AdminHttpError extends Error {
  constructor(
    public status: number,
    public body: any,
    message?: string
  ) {
    super(message || `HTTP Error ${status}`);
    this.name = 'AdminHttpError';
  }
}

interface AdminFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Main admin fetch function
 * Automatically adds X-Admin-Key header from sessionStorage
 */
export async function adminFetch<T = any>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // Get admin key from sessionStorage
  const adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);

  if (!adminKey) {
    throw new AdminHttpError(
      401,
      { error: 'UNAUTHORIZED', message: 'Admin key not found' },
      'Admin key not found in sessionStorage'
    );
  }

  // Prepare headers
  const headers: Record<string, string> = {
    'X-Admin-Key': adminKey,
    ...options.headers,
  };

  // Add Content-Type if body is present
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  // Prepare fetch config
  const config: RequestInit = {
    method: options.method || 'GET',
    credentials: 'include', // Include cookies
    headers,
  };

  // Add body if present
  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);

    // Try to parse response body
    let body: any;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    // If response is not ok, throw AdminHttpError
    if (!response.ok) {
      throw new AdminHttpError(
        response.status,
        body,
        body?.message || body?.error || `Request failed with status ${response.status}`
      );
    }

    return body as T;
  } catch (error) {
    // Re-throw AdminHttpError as-is
    if (error instanceof AdminHttpError) {
      throw error;
    }

    // Network errors or other fetch errors
    throw new Error(
      error instanceof Error ? error.message : 'Network request failed'
    );
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const adminHttp = {
  get: <T = any>(path: string, options?: Omit<AdminFetchOptions, 'method' | 'body'>) =>
    adminFetch<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, body?: any, options?: Omit<AdminFetchOptions, 'method' | 'body'>) =>
    adminFetch<T>(path, { ...options, method: 'POST', body }),

  put: <T = any>(path: string, body?: any, options?: Omit<AdminFetchOptions, 'method' | 'body'>) =>
    adminFetch<T>(path, { ...options, method: 'PUT', body }),

  patch: <T = any>(path: string, body?: any, options?: Omit<AdminFetchOptions, 'method' | 'body'>) =>
    adminFetch<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T = any>(path: string, options?: Omit<AdminFetchOptions, 'method' | 'body'>) =>
    adminFetch<T>(path, { ...options, method: 'DELETE' }),
};
