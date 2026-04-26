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
  signInWithCredential,
  type User as FirebaseUser,
} from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../lib/firebase';
import { api } from '../services/api';
import { authEmitter } from '../services/authEmitter';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { flush as flushOfflineQueue } from '../services/offlineQueue';
import type { UserPreferences } from '@kd/shared';
import type { SocialProvider } from '../components/ui/SocialLoginButton';

WebBrowser.maybeCompleteAuthSession();

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

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
        } catch (error) {
          console.error('[AuthContext] Auth state hydration failed:', error);
          // If profile fetch fails, user might not exist in PG yet
          setUser(null);
          setPreferences(null);
          authEmitter.emit('AUTH_ERROR', 'Could not load your profile. Please check your connection and try signing in again.');
          signOut(auth).catch(() => {});
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
        // Native Google Sign In
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        
        if (response.type === 'success' && response.data?.idToken) {
          const credential = GoogleAuthProvider.credential(response.data.idToken);
          await signInWithCredential(auth, credential);
          registerForPushNotifications().catch(() => {});
        } else if (response.type === 'cancelled') {
          // User aborted the sign-in
          return;
        } else {
          throw new Error('Google Sign-In failed or returned no ID token.');
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
