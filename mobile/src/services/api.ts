// ─── API Client ─────────────────────────────────────────────
// Axios instance with Firebase token injection and safe error handling.

import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { auth } from '../lib/firebase';
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

// ─── Token Injection (Firebase) ─────────────────────────────
// Firebase handles token refresh transparently — getIdToken()
// returns a fresh token if the current one is expired.

async function injectToken(config: InternalAxiosRequestConfig) {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Firebase token retrieval failed — skip gracefully
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

// ─── Shared response handler factory ─────────────────────────
// Since validateStatus lets 4xx through as "successes", ALL status code
// handling happens here. Firebase handles token refresh transparently,
// so we no longer need the manual /auth/refresh retry logic.

function makeResponseHandler(_instance: typeof api) {
  return async (response: AxiosResponse): Promise<AxiosResponse> => {
    // 401 → Firebase token might be revoked or user signed out
    if (response.status === 401) {
      // Try to get a fresh token from Firebase
      try {
        const user = auth.currentUser;
        if (user) {
          const newToken = await user.getIdToken(true); // force refresh
          const config = response.config as InternalAxiosRequestConfig & { _retry?: boolean };
          if (!config._retry) {
            config._retry = true;
            config.headers.Authorization = `Bearer ${newToken}`;
            return _instance(config);
          }
        }
      } catch {
        // Token refresh failed
      }

      // Firebase can't refresh — force logout
      authEmitter.emit('FORCE_LOGOUT');
      return Promise.reject(new Error('Session expired. Please sign in again.'));
    }

    if (response.status === 403) {
      return Promise.reject(new Error('Permission denied.'));
    }

    // If the server returned non-JSON (e.g. HTML 502 page), reject cleanly
    if (!isJsonResponse(response)) {
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
      const err = new Error(msg);
      // Attach the original response so calling code can read custom error payload
      (err as any).response = response;
      return Promise.reject(err);
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
