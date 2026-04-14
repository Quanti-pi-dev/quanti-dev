// ─── API Client ─────────────────────────────────────────────
// Axios instance with token injection, auto-refresh, and safe error handling.

import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { authEmitter } from './authEmitter';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function makeInstance(baseURL: string) {
  return axios.create({
    baseURL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    // Prevent axios from trying to JSON.parse HTML error pages (502/504).
    // 4xx responses come through the success handler, NOT the error handler.
    validateStatus: (status) => status < 500,
  });
}

export const api = makeInstance(`${API_BASE_URL}/api/v1`);
export const adminApi = makeInstance(`${API_BASE_URL}/api/admin`);

// ─── Token Injection ─────────────────────────────────────────

async function injectToken(config: InternalAxiosRequestConfig) {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // SecureStore can fail in some environments — skip gracefully
  }
  return config;
}

api.interceptors.request.use(injectToken);
adminApi.interceptors.request.use(injectToken);

// ─── Response / Error Handling ───────────────────────────────

interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ApiErrorResponse).error?.message === 'string'
  );
}

function isJsonResponse(response: AxiosResponse): boolean {
  const contentType = (response.headers?.['content-type'] as string) ?? '';
  return contentType.includes('application/json');
}

// ─── Token Refresh ───────────────────────────────────────────
// Attempts a silent token refresh using the stored refresh token.
// Returns the new access token on success, or null on failure.
// On failure, clears tokens and emits FORCE_LOGOUT.

let _refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts — if multiple 401s arrive
  // at the same time, they should all wait for the same refresh call.
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync('refresh_token').catch(() => null);
    if (!refreshToken) return null;

    try {
      // Use a plain axios call (not the `api` instance) to avoid
      // the interceptor loop — refresh must bypass token injection.
      const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken });
      const newAccess: string | undefined = data?.data?.accessToken;
      const newRefresh: string | undefined = data?.data?.refreshToken;
      if (!newAccess || !newRefresh) return null;
      await SecureStore.setItemAsync('access_token', newAccess);
      await SecureStore.setItemAsync('refresh_token', newRefresh);
      return newAccess;
    } catch {
      // Refresh failed — clear stored tokens and signal the app to log out
      await SecureStore.deleteItemAsync('access_token').catch(() => {});
      await SecureStore.deleteItemAsync('refresh_token').catch(() => {});
      authEmitter.emit('FORCE_LOGOUT');
      return null;
    }
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
}

// ─── Shared response handler factory ─────────────────────────
// Since validateStatus lets 4xx through as "successes", ALL status code
// handling happens here — including 401 refresh. The error handler below
// only fires for 5xx and network-level errors.

function makeResponseHandler(instance: typeof api) {
  return async (response: AxiosResponse): Promise<AxiosResponse> => {
    // 401 → attempt silent token refresh, then retry once
    if (response.status === 401) {
      // Guard against infinite retry loops
      const config = response.config as InternalAxiosRequestConfig & { _retry?: boolean };
      if (config._retry) {
        return Promise.reject(new Error('Session expired. Please sign in again.'));
      }

      const newToken = await attemptTokenRefresh();
      if (newToken && response.config) {
        config._retry = true;
        response.config.headers.Authorization = `Bearer ${newToken}`;
        return instance(response.config);
      }

      return Promise.reject(new Error('Session expired. Please sign in again.'));
    }

    if (response.status === 403) {
      return Promise.reject(new Error('Permission denied.'));
    }

    // If the server returned non-JSON (e.g. HTML 502 page), reject cleanly
    if (!isJsonResponse(response)) {
      // Try to extract a meaningful message from the text body
      const textBody = typeof response.data === 'string' ? response.data.slice(0, 200) : '';
      const cleanMsg = textBody.replace(/<[^>]*>/g, '').trim();
      const msg = cleanMsg || `Server error (${response.status}). Please try again.`;
      return Promise.reject(new Error(msg));
    }

    // Treat remaining 4xx as errors
    if (response.status >= 400) {
      let msg = `Error ${response.status}`;
      if (isApiErrorResponse(response.data)) {
        msg = response.data.error.message;
      } else if (typeof response.data === 'string' && response.data.length > 0) {
        msg = response.data.slice(0, 200);
      }
      return Promise.reject(new Error(msg));
    }

    return response;
  };
}

// ─── GET-only retry with exponential backoff ─────────────────
// Retries idempotent GET requests on network errors or 5xx responses.
// POST/PUT/DELETE are never retried to avoid mutation duplication.

const MAX_RETRIES = 2;
const RETRY_DELAYS = [500, 1500]; // exponential backoff (ms)

function isRetryable(error: AxiosError): boolean {
  // Only retry GET requests
  if (error.config?.method?.toUpperCase() !== 'GET') return false;

  // Network error (no response received)
  if (!error.response) return true;

  // 503 Service Unavailable or 502 Bad Gateway
  const status = error.response.status;
  return status === 502 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Network-level error handler with retry ──────────────────
// Wraps raw AxiosErrors in user-friendly messages so they surface
// cleanly in UI components instead of showing raw error objects.

function makeNetworkErrorHandler(instance: typeof api) {
  return async (error: AxiosError): Promise<never> => {
    // ─── Retry logic for GET requests ─────────────────
    if (isRetryable(error) && error.config) {
      const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
      const retryCount = config._retryCount ?? 0;

      if (retryCount < MAX_RETRIES) {
        config._retryCount = retryCount + 1;
        await sleep(RETRY_DELAYS[retryCount] ?? 1500);
        return instance(config) as Promise<never>;
      }
    }

    // ─── User-friendly error messages ─────────────────
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      return Promise.reject(new Error('Request timed out. Please check your connection and try again.'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your internet connection.'));
    }
    // 5xx errors that bypassed validateStatus — provide a clean message
    const status = error.response.status;
    return Promise.reject(new Error(`Server error (${status}). Please try again later.`));
  };
}

api.interceptors.response.use(
  makeResponseHandler(api),
  makeNetworkErrorHandler(api),
);

adminApi.interceptors.response.use(
  makeResponseHandler(adminApi),
  makeNetworkErrorHandler(adminApi),
);
