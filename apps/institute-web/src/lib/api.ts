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
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
