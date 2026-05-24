'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const { login }        = useAuth();
  const router           = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch {
      setError('Invalid credentials or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Wordmark */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/logo.jpg"
              alt="QuantiPi"
              width={80}
              height={80}
              className="rounded-2xl shadow-lg shadow-violet-900/40"
              priority
            />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            QuantiPi <span className="text-violet-400">Admin</span>
          </span>
          <p className="mt-1 text-sm text-zinc-500">Sign in to the control panel</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-5 shadow-xl shadow-black/40"
        >
          {error && (
            <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white
                         placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500
                         focus:border-transparent transition"
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white
                         placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500
                         focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
