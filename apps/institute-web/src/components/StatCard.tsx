'use client';

import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  delta?: string;
  deltaPositive?: boolean;
  gradient?: string;
}

export function StatCard({ label, value, icon: Icon, delta, deltaPositive, gradient }: StatCardProps) {
  const bg = gradient ?? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)';
  const iconBg = gradient ?? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';

  return (
    <div className="glass p-5 animate-fade-in hover:scale-[1.01] transition-transform duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {delta && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            deltaPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
          }`}>
            {deltaPositive ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm" style={{ color: 'var(--color-surface-300)' }}>{label}</p>
    </div>
  );
}

// ── Skeleton loader ──────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="skeleton w-10 h-10 rounded-xl" />
      </div>
      <div className="skeleton h-8 w-24 rounded mb-2" />
      <div className="skeleton h-4 w-32 rounded" />
    </div>
  );
}
