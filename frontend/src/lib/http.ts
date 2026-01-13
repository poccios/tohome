/**
 * HTTP Client wrapper with centralized configuration
 * - Includes credentials (cookies) in all requests
 * - Handles API base URL from env
 * - Throws errors with status + body for easy error handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: any,
    message?: string
  ) {
    super(message || `HTTP Error ${status}`);
    this.name = 'HttpError';
  }
}

interface FetchOptions extends RequestInit {
  // Allow any additional options
}

/**
 * Main HTTP client function
 * @param path - API path (e.g., '/me', '/restaurants')
 * @param options - Fetch options (method, headers, body, etc.)
 */
export async function http<T = any>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // Only set Content-Type if body is present
  const defaultHeaders: Record<string, string> = {};
  if (options.body) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  // Merge default options with provided options
  const config: RequestInit = {
    credentials: 'include', // Always include cookies
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    ...options,
  };

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

    // If response is not ok, throw HttpError
    if (!response.ok) {
      throw new HttpError(
        response.status,
        body,
        body?.message || body?.error || `Request failed with status ${response.status}`
      );
    }

    return body as T;
  } catch (error) {
    // Re-throw HttpError as-is
    if (error instanceof HttpError) {
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
export const httpClient = {
  get: <T = any>(path: string, options?: FetchOptions) =>
    http<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, data?: any, options?: FetchOptions) => {
    const hasBody = data !== undefined;
    return http<T>(path, {
      ...options,
      method: 'POST',
      body: hasBody ? JSON.stringify(data) : undefined,
      headers: hasBody
        ? { 'Content-Type': 'application/json', ...options?.headers }
        : options?.headers,
    });
  },

  patch: <T = any>(path: string, data?: any, options?: FetchOptions) =>
    http<T>(path, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(path: string, data?: any, options?: FetchOptions) =>
    http<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(path: string, options?: FetchOptions) =>
    http<T>(path, { ...options, method: 'DELETE' }),
};
