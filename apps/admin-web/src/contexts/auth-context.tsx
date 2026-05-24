'use client';

// ─── Auth Context ─────────────────────────────────────────────
// Wraps the whole app. Provides the current Firebase user and a
// loading flag. Only lets through users whose custom claim role === 'admin'.

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import {
  User, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Verify admin custom claim
        const token = await firebaseUser.getIdTokenResult();
        if (token.claims['role'] !== 'admin') {
          await signOut(auth);
          setUser(null);
          router.push('/login?error=not-admin');
        } else {
          setUser(firebaseUser);
          if (pathname === '/login') router.push('/');
        }
      } else {
        setUser(null);
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
