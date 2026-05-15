'use client';

import {
  createContext, useContext, useEffect, useState, ReactNode,
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult();
        const role = token.claims['institute_role'] as string | undefined;
        const iid  = token.claims['institute_id'] as string | undefined;

        if (!role || !VALID_ROLES.includes(role as InstituteRole)) {
          await signOut(auth);
          setUser(null);
          router.push('/login?error=not-authorized');
        } else {
          setUser(firebaseUser);
          setRole(role as InstituteRole);
          setInstituteId(iid ?? null);
          if (pathname === '/login') router.push('/');
        }
      } else {
        setUser(null);
        setRole(null);
        setInstituteId(null);
        if (pathname !== '/login') router.push('/login');
      }
      setLoading(false);
    });
    return unsub;
  }, [pathname, router]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
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
