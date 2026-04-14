// ─── Auth Context ───────────────────────────────────────────
// Manages authentication state, login/logout, and token storage.

import {  createContext, useContext, useState, useEffect, useMemo, useCallback  } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../services/api';
import { authEmitter } from '../services/authEmitter';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { flush as flushOfflineQueue } from '../services/offlineQueue';
import type { UserPreferences } from '@kd/shared';
import type { SocialProvider } from '../components/ui/SocialLoginButton';

WebBrowser.maybeCompleteAuthSession();

// ─── Types ──────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'student' | 'admin';
}

interface AuthContextValue {
  user: AuthUser | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider?: SocialProvider) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signupWithPassword: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ─── Auth0 Config ───────────────────────────────────────────

const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? 'your-tenant.auth0.com';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '';

// Maps our provider labels to the Auth0 connection string.
// Passing `connection` as an extraParam skips the hosted login page
// and redirects the user straight to the chosen identity provider.
const PROVIDER_CONNECTION_MAP: Record<SocialProvider, string> = {
  google:    'google-oauth2',
  github:    'github',
  microsoft: 'windowslive',
  facebook:  'facebook',
  linkedin:  'linkedin',
};

// Auth0 discovery is called inside the provider (Rules of Hooks)

// ─── Context ────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);
  const { registerForPushNotifications, unregisterPushToken } = usePushNotifications();

  // ─── Shared profile hydration (FIX P3) ──────────────────
  // Single helper for the duplicated /auth/me + /users/preferences pair.
  const hydrateProfile = useCallback(async () => {
    const [meRes, prefRes] = await Promise.all([
      api.get('/auth/me'),
      api.get('/users/preferences'),
    ]);
    setUser(meRes.data?.data ?? null);
    setPreferences(prefRes.data?.data ?? null);
  }, []);

  // Check for existing session on mount; attempt refresh before giving up
  const checkExistingSession = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        try {
          await hydrateProfile();
          // Flush any queued offline mutations now that we're back online
          flushOfflineQueue().catch(() => {});
        } catch {
          // Access token may be expired — attempt silent refresh
          const refreshToken = await SecureStore.getItemAsync('refresh_token').catch(() => null);
          if (refreshToken) {
            try {
              const { data } = await api.post('/auth/refresh', { refreshToken });
              const newAccess = data?.data?.accessToken;
              const newRefresh = data?.data?.refreshToken;
              if (!newAccess || !newRefresh) throw new Error('Invalid refresh response');
              await SecureStore.setItemAsync('access_token', newAccess);
              await SecureStore.setItemAsync('refresh_token', newRefresh);
              await hydrateProfile();
            } catch {
              // Refresh also failed — clear everything and signal logout (FIX B1)
              await SecureStore.deleteItemAsync('access_token');
              await SecureStore.deleteItemAsync('refresh_token');
              authEmitter.emit('FORCE_LOGOUT');
            }
          } else {
            // No refresh token — clear access token and signal logout (FIX B1)
            await SecureStore.deleteItemAsync('access_token');
            authEmitter.emit('FORCE_LOGOUT');
          }
        }
      }
    } catch {
      // Unexpected error (e.g. SecureStore unavailable)
    } finally {
      setIsLoading(false);
    }
  }, [hydrateProfile]);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  // Subscribe to forced logout events from the Axios interceptor
  useEffect(() => {
    const unsub = authEmitter.on('FORCE_LOGOUT', () => {
      setUser(null);
      setPreferences(null);
    });
    return unsub;
  }, []);

  const login = useCallback(async (provider?: SocialProvider) => {
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kd-study' });

      // When a provider is specified, pass the connection hint so Auth0 bypasses
      // the hosted login page and redirects directly to the chosen IdP.
      const extraParams: Record<string, string> = provider
        ? { connection: PROVIDER_CONNECTION_MAP[provider] }
        : {};

      const authRequest = new AuthSession.AuthRequest({
        clientId: AUTH0_CLIENT_ID,
        redirectUri,
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams,
      });

      if (!discovery) {
        throw new Error('Auth service is not ready yet. Please try again.');
      }
      const result = await authRequest.promptAsync(discovery);

      if (result.type === 'success' && result.params['code']) {
        // Exchange code for tokens via our API
        const { data } = await api.post('/auth/callback', {
          code: result.params['code'],
          redirectUri,
        });

        const accessToken = data?.data?.accessToken;
        const refreshToken = data?.data?.refreshToken;
        if (!accessToken || !refreshToken) throw new Error('Invalid auth callback response');
        await SecureStore.setItemAsync('access_token', accessToken);
        await SecureStore.setItemAsync('refresh_token', refreshToken);

        // Fetch user profile and preferences (FIX P3)
        await hydrateProfile();
        // Register push notifications & flush offline queue (same as email login)
        registerForPushNotifications().catch(() => {});
        flushOfflineQueue().catch(() => {});
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [discovery, hydrateProfile, registerForPushNotifications]);

  // ─── Shared token + profile hydration ──────────────────
  const hydrateFromTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    // Persist tokens first so the axios interceptor can inject them immediately
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    try {
      await hydrateProfile();
      // Register device for push notifications after successful login
      registerForPushNotifications().catch(() => {});
      // Flush any queued offline mutations now that we're online & authenticated
      flushOfflineQueue().catch(() => {});
    } catch (err) {
      // If profile fetch fails, clean up tokens so the app doesn't get stuck
      await SecureStore.deleteItemAsync('access_token').catch(() => {});
      await SecureStore.deleteItemAsync('refresh_token').catch(() => {});
      throw err;
    }
  }, [hydrateProfile, registerForPushNotifications]);

  // ─── Email/Password login (ROPC) ─────────────────────
  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const accessToken = data?.data?.accessToken;
    const refreshToken = data?.data?.refreshToken;
    if (!accessToken || !refreshToken) throw new Error('Invalid login response');
    await hydrateFromTokens(accessToken, refreshToken);
  }, [hydrateFromTokens]);

  // ─── Email/Password signup ────────────────────────────
  const signupWithPassword = useCallback(async (email: string, password: string, displayName: string) => {
    const { data } = await api.post('/auth/register', { email, password, displayName });
    const accessToken = data?.data?.accessToken;
    const refreshToken = data?.data?.refreshToken;
    if (!accessToken || !refreshToken) throw new Error('Invalid signup response');
    await hydrateFromTokens(accessToken, refreshToken);
  }, [hydrateFromTokens]);

  const logout = useCallback(async () => {
    // Unregister push token before clearing session
    await unregisterPushToken();
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort server logout
    }
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    setUser(null);
    setPreferences(null);
  }, [unregisterPushToken]);

  const refreshUser = useCallback(async () => {
    try {
      await hydrateProfile();
    } catch {
      // Silent fail
    }
  }, [hydrateProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      preferences,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginWithPassword,
      signupWithPassword,
      logout,
      refreshUser,
    }),
    [user, preferences, isLoading, login, loginWithPassword, signupWithPassword, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
