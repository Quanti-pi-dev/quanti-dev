// ─── TutorSkeletons ──────────────────────────────────────────
// Shimmer loading placeholders for the AI tutor widgets.
// Shown while useLearningProfile is fetching data.

import { View } from 'react-native';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Skeleton } from './ui/Skeleton';

/** Skeleton for the TutorBriefCard on the Home screen. */
export function TutorBriefSkeleton() {
  return (
    <View style={{
      borderRadius: radius['2xl'],
      padding: spacing.lg,
      gap: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width={120} height={14} />
      </View>
      <Skeleton width="100%" height={14} />
      <Skeleton width="80%" height={14} />
      <Skeleton width={100} height={36} borderRadius={10} />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <Skeleton width={90} height={12} />
        <Skeleton width={70} height={12} />
      </View>
    </View>
  );
}

/** Skeleton for KnowledgeHealthCompact. */
export function KnowledgeHealthSkeleton() {
  return (
    <View style={{
      borderRadius: radius['2xl'],
      padding: spacing.lg,
      gap: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Skeleton width={28} height={28} borderRadius={radius.lg} />
        <Skeleton width={130} height={14} />
      </View>
      {/* Strongest */}
      <Skeleton width={60} height={10} />
      <View style={{ gap: spacing.xs }}>
        <Skeleton width="100%" height={12} />
        <Skeleton width="100%" height={4} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="100%" height={4} />
      </View>
      {/* Weakest */}
      <Skeleton width={70} height={10} />
      <View style={{ gap: spacing.xs }}>
        <Skeleton width="100%" height={12} />
        <Skeleton width="100%" height={4} />
      </View>
    </View>
  );
}

/** Skeleton for ExamReadinessGauge. */
export function ExamReadinessSkeleton() {
  return (
    <View style={{
      borderRadius: radius['2xl'],
      padding: spacing.lg,
      gap: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={28} height={28} borderRadius={radius.lg} />
          <Skeleton width={110} height={14} />
        </View>
        <Skeleton width={50} height={32} borderRadius={radius.md} />
      </View>
      {/* 5 signal bars */}
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={80} height={10} />
            <Skeleton width={30} height={10} />
          </View>
          <Skeleton width="100%" height={3} />
        </View>
      ))}
    </View>
  );
}

/** Skeleton for NextMilestoneCard. */
export function NextMilestoneSkeleton() {
  return (
    <View style={{
      borderRadius: radius['2xl'],
      padding: spacing.lg,
      gap: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width={100} height={14} />
          <Skeleton width={140} height={10} />
        </View>
        <Skeleton width={60} height={12} />
      </View>
      <Skeleton width="100%" height={8} borderRadius={4} />
      <Skeleton width="90%" height={14} />
    </View>
  );
}

/** Combined skeleton block for the Home screen intelligence section. */
export function HomeTutorSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      <TutorBriefSkeleton />
      <KnowledgeHealthSkeleton />
      <ExamReadinessSkeleton />
    </View>
  );
}
