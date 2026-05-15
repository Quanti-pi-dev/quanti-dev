'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { BookOpen, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid credentials or insufficient permissions. Make sure you have an institute staff role.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%), var(--color-surface-950)' }}>

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c084fc 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="glass w-full max-w-md p-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #c084fc 100%)' }}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-indigo-400 font-medium tracking-widest uppercase">QuantiPi</p>
            <h1 className="text-white font-bold text-lg leading-tight">Institute Portal</h1>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--color-surface-300)' }}>
          Sign in with your institute staff credentials
        </p>

        {error && (
          <div className="flex items-start gap-3 mb-6 p-4 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />
              <input id="email" type="email" autoComplete="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@institute.edu"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
                style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-surface-600)')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />
              <input id="password" type="password" autoComplete="current-password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
                style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-surface-600)')} />
            </div>
          </div>

          <button id="login-submit" type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-center mt-8" style={{ color: 'var(--color-surface-400)' }}>
          Access restricted to institute educators, examiners, and admins.
        </p>
      </div>
    </div>
  );
}
