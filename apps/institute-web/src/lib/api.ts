import axios from 'axios';
import { auth } from './firebase';
import { env } from './env';

export const api = axios.create({
  baseURL: env.instituteApiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    // Force-refresh=true picks up latest custom claims (institute_role)
    const token = await user.getIdToken(false);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Do NOT hard-redirect on 401/403 here.
    // The AuthProvider already monitors Firebase auth state and navigates to
    // /login when the session is invalid. Doing window.location here creates
    // a redirect loop: API error → /login → login → dashboard → API error → …
    return Promise.reject(error);
  },
);
