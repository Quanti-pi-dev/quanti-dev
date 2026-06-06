// ─── Social Proof Badge ─────────────────────────────────────
// Reusable component showing live student activity counts.
// Fetches from GET /stats/active-students and displays
// contextual badges (global count, exam popularity, trending subject).
//
// Psychology: Social Proof (Cialdini) + Bandwagon Effect —
// seeing others participate reduces commitment anxiety.

import { useMemo } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { apiGet } from '../../services/api-contracts';

interface PlatformStats {
  activeStudents: number;
  examCounts: Record<string, number>;
  trendingSubjects: Array<{ subjectId: string; count: number }>;
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

// ─── Global Activity Counter ─────────────────────────────────
export function GlobalActivityBadge({ delay = 0 }: { delay?: number }) {
  const { theme, isDark } = useTheme();

  const { data } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: () => apiGet<PlatformStats>('/stats/active-students'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  if (!data || data.activeStudents === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.12)',
        alignSelf: 'center',
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#10B981',
        }}
      />
      <Typography variant="caption" color="#10B981">
        {formatCount(data.activeStudents)} students studying today
      </Typography>
    </Animated.View>
  );
}

// ─── Exam Popularity Badge ───────────────────────────────────
export function ExamPopularityBadge({
  examId,
  delay = 0,
}: {
  examId: string;
  delay?: number;
}) {
  const { theme, isDark } = useTheme();

  const { data } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: () => apiGet<PlatformStats>('/stats/active-students'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const count = data?.examCounts?.[examId];
  if (!count || count < 10) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(300)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs - 2,
        marginTop: spacing.xs,
      }}
    >
      <Ionicons name="people-outline" size={11} color={theme.textTertiary} />
      <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
        {formatCount(count)} preparing
      </Typography>
    </Animated.View>
  );
}

// ─── Subject Trending Badge ──────────────────────────────────
export function SubjectTrendingBadge({
  subjectId,
  delay = 0,
}: {
  subjectId: string;
  delay?: number;
}) {
  const { theme, isDark } = useTheme();

  const { data } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: () => apiGet<PlatformStats>('/stats/active-students'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isTrending = useMemo(() => {
    if (!data?.trendingSubjects) return false;
    const idx = data.trendingSubjects.findIndex(s => s.subjectId === subjectId);
    return idx >= 0 && idx < 3; // Top 3 = trending
  }, [data, subjectId]);

  if (!isTrending) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(300)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs - 2,
        backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.06)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
      }}
    >
      <Typography variant="caption" color="#F59E0B" style={{ fontSize: 10 }}>
        🔥 Trending
      </Typography>
    </Animated.View>
  );
}
