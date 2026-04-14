// ─── Subject List Screen ─────────────────────────────────────
// Displays all subjects for an exam. Shows level-bubble row per
// subject (6 bubbles, filled = unlocked). Subscription-gates subjects
// beyond the user's tier limit.

import { useMemo } from 'react';
import { View, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { spacing, radius } from '@/theme/tokens';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Header } from '@/components/layout/Header';
import { Typography } from '@/components/ui/Typography';
import { Skeleton } from '@/components/ui/Skeleton';
import { LockedFeature } from '@/components/subscription/LockedFeature';
import { LockedFeatureBanner } from '@/components/subscription/LockedFeature';
import { useExamSubjects, useExamProgress } from '@/hooks/useSubjects';
import { useExamsUsedToday } from '@/hooks/useExamsUsedToday';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { SUBJECT_LEVELS } from '@kd/shared';
import type { Subject } from '@kd/shared';

const LEVEL_COLOURS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'] as const;

export default function SubjectsScreen() {
  const { examId, title, tournamentId } = useLocalSearchParams<{ examId: string; title?: string; tournamentId?: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { isSubjectLocked, isDailyLimitReached, maxExamsPerDay } = useSubscriptionGate();

  const { data: subjects, isLoading, isError } = useExamSubjects(examId);
  const subjectIds = subjects?.map((s: Subject) => s.id) ?? [];
  const { data: examProgress } = useExamProgress(examId, subjectIds);

  // Build lookup: subjectId → highest unlocked level index
  const progressMap = useMemo(() => new Map(
    (examProgress ?? []).map((p) => {
      const idx = SUBJECT_LEVELS.indexOf(p.highestUnlockedLevel);
      return [p.subjectId, idx];
    }),
  ), [examProgress]);

  const { examsUsedToday } = useExamsUsedToday();
  const sessionLimitReached = isDailyLimitReached(examsUsedToday);

  if (isLoading) {
    return (
      <ScreenWrapper>
        <Header showBack title={title ?? 'Subjects'} />
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              height={90}
              borderRadius={radius['2xl']}
            />
          ))}
        </View>
      </ScreenWrapper>
    );
  }

  if (isError || !subjects) {
    return (
      <ScreenWrapper>
        <Header showBack title={title ?? 'Subjects'} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
          <Typography variant="body" align="center" color={theme.textSecondary}>
            Could not load subjects. Please try again.
          </Typography>
        </View>
      </ScreenWrapper>
    );
  }

  function handleSubjectPress(subject: Subject, index: number) {
    if (isSubjectLocked(index) || sessionLimitReached) return;
    router.push({
      pathname: '/exams/[examId]/subjects/[subjectId]/levels',
      params: { examId, subjectId: subject.id, title: subject.name, ...(tournamentId ? { tournamentId } : {}) },
    } as never);
  }

  return (
    <ScreenWrapper>
      <Header showBack title={title ?? 'Subjects'} />

      <FlatList
        data={subjects as Subject[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          sessionLimitReached ? (
            <View
              style={{
                backgroundColor: theme.cardAlt,
                borderRadius: radius['2xl'],
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="ban-outline" size={16} color={theme.error} />
              <Typography variant="bodySmall" color={theme.error}>
                Daily limit reached ({maxExamsPerDay} sessions). Upgrade for more.
              </Typography>
            </View>
          ) : null
        }
        renderItem={({ item: subject, index }) => {
          const locked = isSubjectLocked(index);
          const highestIdx = progressMap.get(subject.id) ?? -1;
          const requiredTier = index < 3 ? (1 as const) : (2 as const);

          const card = (
            <TouchableOpacity
              onPress={() => handleSubjectPress(subject, index)}
              disabled={locked || sessionLimitReached}
              activeOpacity={0.75}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius['2xl'],
                padding: spacing.lg,
                borderWidth: 1.5,
                borderColor: locked ? theme.border : (subject.accent ?? theme.border),
                gap: spacing.sm,
                opacity: locked ? 0.5 : 1,
              }}
            >
              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 40, height: 40, borderRadius: radius.full,
                    backgroundColor: (subject.accent ?? theme.primary) + '22',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={(subject.iconName as never) ?? 'book-outline'}
                    size={20}
                    color={subject.accent ?? theme.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="label">{subject.name}</Typography>
                  {subject.description ? (
                    <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
                      {subject.description}
                    </Typography>
                  ) : null}
                </View>
                {!locked && (
                  <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
                )}
              </View>

              {/* 6 level bubbles */}
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {SUBJECT_LEVELS.map((level, lvlIdx) => {
                  const isUnlocked = lvlIdx <= highestIdx;
                  const colour = LEVEL_COLOURS[lvlIdx] ?? theme.primary;
                  return (
                    <View
                      key={level}
                      style={{
                        flex: 1, height: 6, borderRadius: 3,
                        backgroundColor: isUnlocked ? colour : theme.border,
                      }}
                    />
                  );
                })}
              </View>

              {highestIdx >= 0 && !locked && (
                <Typography variant="caption" color={subject.accent ?? theme.primary}>
                  Resume: {SUBJECT_LEVELS[highestIdx]}
                </Typography>
              )}
            </TouchableOpacity>
          );

          if (locked) {
            return (
              <LockedFeature minTier={requiredTier} label="Upgrade to unlock more subjects">
                {card}
              </LockedFeature>
            );
          }

          return card;
        }}
        ListFooterComponent={
          (subjects as Subject[]).some((_: Subject, i: number) => isSubjectLocked(i)) ? (
            <View style={{ marginTop: spacing.md }}>
              <LockedFeatureBanner feature="Upgrade to access all subjects in this exam" minTier={2} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <Typography variant="body" color={theme.textTertiary} align="center">
              No subjects for this exam yet.
            </Typography>
          </View>
        }
      />
    </ScreenWrapper>
  );
}
