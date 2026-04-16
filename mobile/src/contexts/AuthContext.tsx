// ─── Auth Context ───────────────────────────────────────────
// Manages authentication state using Firebase JS Web SDK.
// Handles login/logout, social auth, and token storage.

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type User as FirebaseUser,
} from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../lib/firebase';
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

// ─── Context ────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { registerForPushNotifications, unregisterPushToken } = usePushNotifications();

  // ─── Shared profile hydration ──────────────────────────
  // Fetches user profile and preferences from our backend.
  const hydrateProfile = useCallback(async () => {
    const [meRes, prefRes] = await Promise.all([
      api.get('/auth/me'),
      api.get('/users/preferences'),
    ]);
    setUser(meRes.data?.data ?? null);
    setPreferences(prefRes.data?.data ?? null);
  }, []);

  // ─── Sync user to backend ─────────────────────────────
  // Calls POST /auth/sync to lazily create/update the user in PostgreSQL.
  const syncUserToBackend = useCallback(async (firebaseUser: FirebaseUser) => {
    try {
      await api.post('/auth/sync', {
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Student',
        avatarUrl: firebaseUser.photoURL,
      });
    } catch {
      // Non-critical — user may already exist
    }
  }, []);

  // ─── Firebase auth state listener ─────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Sync to backend first, then hydrate profile
          await syncUserToBackend(firebaseUser);
          await hydrateProfile();
          // Flush any queued offline mutations now that we're authenticated
          flushOfflineQueue().catch(() => {});
        } catch {
          // If profile fetch fails, user might not exist in PG yet
          setUser(null);
          setPreferences(null);
        }
      } else {
        setUser(null);
        setPreferences(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [hydrateProfile, syncUserToBackend]);

  // Subscribe to forced logout events from the Axios interceptor
  useEffect(() => {
    const unsub = authEmitter.on('FORCE_LOGOUT', async () => {
      try {
        await signOut(auth);
      } catch {
        // Best-effort
      }
      setUser(null);
      setPreferences(null);
    });
    return unsub;
  }, []);

  // ─── Social login (Google, Twitter) ──────────────────────
  const login = useCallback(async (provider?: SocialProvider) => {
    if (!provider) {
      // No provider specified — open a generic Google login
      provider = 'google';
    }

    try {
      if (provider === 'google') {
        // Use expo-auth-session for Google OAuth in Expo Go
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kd-study', path: 'callback' });
        const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

        const request = new AuthSession.AuthRequest({
          clientId: googleClientId,
          redirectUri,
          scopes: ['openid', 'profile', 'email'],
          responseType: AuthSession.ResponseType.IdToken,
          extraParams: {
            nonce: Math.random().toString(36).substring(2),
          },
        });

        const discovery = {
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
          revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
        };

        const result = await request.promptAsync(discovery);

        if (result.type === 'success' && result.params['id_token']) {
          const credential = GoogleAuthProvider.credential(result.params['id_token']);
          await signInWithCredential(auth, credential);
          registerForPushNotifications().catch(() => {});
        }
      } else if (provider === 'twitter') {
        // Twitter OAuth 2.0 with PKCE via expo-auth-session.
        // Firebase's twitter.com provider accepts OAuth access tokens
        // via the generic OAuthProvider.credential() interface.
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kd-study', path: 'callback' });
        const twitterClientId = process.env.EXPO_PUBLIC_TWITTER_CLIENT_ID ?? '';

        const request = new AuthSession.AuthRequest({
          clientId: twitterClientId,
          redirectUri,
          scopes: ['users.read', 'tweet.read'],
          responseType: AuthSession.ResponseType.Code,
          usePKCE: true,
        });

        const discovery: AuthSession.DiscoveryDocument = {
          authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
          tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
        };

        const result = await request.promptAsync(discovery);

        if (result.type === 'success' && result.params['code']) {
          // Exchange authorization code for access token using PKCE
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: twitterClientId,
              code: result.params['code'],
              redirectUri,
              extraParams: {
                code_verifier: request.codeVerifier!,
              },
            },
            discovery,
          );

          // Create Firebase credential with the Twitter access token
          const twitterProvider = new OAuthProvider('twitter.com');
          const credential = twitterProvider.credential({
            accessToken: tokenResult.accessToken,
          });
          await signInWithCredential(auth, credential);
          registerForPushNotifications().catch(() => {});
        }
      } else {
        throw new Error(`Social login for ${provider as string} is not supported`);
      }
    } catch (error) {
      console.error('Social login failed:', error);
      throw error;
    }
  }, [registerForPushNotifications]);

  // ─── Email/Password login ─────────────────────────────
  const loginWithPassword = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    registerForPushNotifications().catch(() => {});
    flushOfflineQueue().catch(() => {});
  }, [registerForPushNotifications]);

  // ─── Email/Password signup ────────────────────────────
  const signupWithPassword = useCallback(async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Set the display name on the Firebase user profile
    await updateProfile(userCredential.user, { displayName });
    registerForPushNotifications().catch(() => {});
    flushOfflineQueue().catch(() => {});
  }, [registerForPushNotifications]);

  // ─── Logout ──────────────────────────────────────────
  const logout = useCallback(async () => {
    // Unregister push token before clearing session
    await unregisterPushToken();
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort server logout
    }
    await signOut(auth);
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
