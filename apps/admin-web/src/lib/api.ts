// ─── Admin API Client ─────────────────────────────────────────
// Axios instance pre-configured for the Admin API.
// Automatically injects the Firebase ID token on every request.
// Handles 401 → redirect to /login transparently.

import axios from 'axios';
import { auth } from './firebase';
import { env } from './env';

export const adminApi = axios.create({
  baseURL: env.adminApiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ─── Request Interceptor — Inject Firebase ID token ──────────
adminApi.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor — Handle auth errors ───────────────
adminApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Redirect to login — use window.location to avoid circular imports
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
