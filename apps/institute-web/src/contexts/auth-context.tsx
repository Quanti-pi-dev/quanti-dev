'use client';

import {
  createContext, useContext, useEffect, useRef, useState, ReactNode,
} from 'react';
import {
  User, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────

export type InstituteRole = 'educator' | 'examiner' | 'institute_admin';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  instituteRole: InstituteRole | null;
  instituteId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const VALID_ROLES: InstituteRole[] = ['educator', 'examiner', 'institute_admin'];

// ─── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [instituteRole, setRole]      = useState<InstituteRole | null>(null);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  // Prevents the null-user onAuthStateChanged from redirecting to /login
  // when we ourselves just called signOut (e.g. unauthorized user or logout).
  const redirectingOutRef = useRef(false);

  // ── Step 1: resolve auth state (no navigation here) ──────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Force-refresh=true ensures we always read the latest custom claims
        // (institute_role / institute_id) set by the backend after provisioning.
        // Without this, Firebase may serve a cached token lacking the claims,
        // which then incorrectly triggers the signOut → loop.
        const token = await firebaseUser.getIdTokenResult(/* forceRefresh */ true);
        const role  = token.claims['institute_role'] as string | undefined;
        const iid   = token.claims['institute_id']   as string | undefined;

        if (!role || !VALID_ROLES.includes(role as InstituteRole)) {
          // Not an institute staff member — sign them out quietly.
          // Set the flag BEFORE calling signOut so the subsequent
          // onAuthStateChanged(null) doesn't double-navigate.
          redirectingOutRef.current = true;
          await signOut(auth);
          setUser(null);
          setRole(null);
          setInstituteId(null);
          setLoading(false);
          router.replace('/login?error=not-authorized');
        } else {
          setUser(firebaseUser);
          setRole(role as InstituteRole);
          setInstituteId(iid ?? null);
          setLoading(false);
        }
      } else {
        // User signed out
        if (!redirectingOutRef.current) {
          // Genuine sign-out (session expired, revoked, etc.) — navigate to login.
          // We do NOT navigate if redirectingOutRef is true because the code above
          // already called router.replace('/login?error=…').
          setUser(null);
          setRole(null);
          setInstituteId(null);
          setLoading(false);
        } else {
          // We triggered the signOut ourselves — just reset the flag.
          redirectingOutRef.current = false;
          // State was already cleared above; just ensure loading is false.
          setLoading(false);
        }
      }
    });
    return unsub;
  // router is stable (Next.js guarantees this); no other deps needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Step 2: redirect based on resolved auth state ────────────
  // Runs only AFTER loading finishes so we never redirect on transient state.
  useEffect(() => {
    if (loading) return;

    const onLogin  = pathname === '/login';
    if (user && onLogin) {
      // Authenticated user landed on /login — send to dashboard.
      router.replace('/');
    } else if (!user && !onLogin && !redirectingOutRef.current) {
      // Unauthenticated user on a protected page — send to login.
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // Navigation is handled by the effect above once onAuthStateChanged fires.
  };

  const logout = async () => {
    redirectingOutRef.current = true;
    await signOut(auth);
    setUser(null);
    setRole(null);
    setInstituteId(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, instituteRole, instituteId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
