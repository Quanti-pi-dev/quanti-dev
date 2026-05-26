'use client';

// ─── Shared Breadcrumb ────────────────────────────────────────
// Usage:
//   <Breadcrumb items={[
//     { label: 'Exams', href: '/exams' },
//     { label: exam.title, href: `/exams/${id}` },
//     { label: 'Subjects' },
//   ]} />

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { BreadcrumbItem } from './breadcrumb-types';

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-zinc-500 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} className="text-zinc-700 shrink-0" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-zinc-300 transition-colors truncate max-w-[140px]"
              title={item.label}
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-300 font-medium truncate max-w-[160px]" title={item.label}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
