// ─── Level Selector Screen (Topic-Scoped) ─────────────────────
// Shows all topics for a subject within an exam.
// Each topic expands to reveal its 6 levels with:
//   - progress bars, unlock thresholds, accuracy %
//   - dual-layer gate: (1) progress gate (2) tier gate
//   - daily limit enforcement
//
// Navigation: Exam → Subject → [Topics accordion] → Flashcard Player
//
// Topics are fetched dynamically from the API (GET /subjects/:id/topics).

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../src/theme';
import { spacing, radius } from '../../../../../src/theme/tokens';
import { ScreenWrapper } from '../../../../../src/components/layout/ScreenWrapper';
import { Header } from '../../../../../src/components/layout/Header';
import { Typography } from '../../../../../src/components/ui/Typography';
import { ProgressBar } from '../../../../../src/components/ui/ProgressBar';
import { Skeleton } from '../../../../../src/components/ui/Skeleton';
import { LockedFeatureBanner } from '../../../../../src/components/subscription/LockedFeature';
import { DailyLimitBanner } from '../../../../../src/components/subscription/DailyLimitBanner';
import { useSubjectLevelSummary, useSubjectTopics } from '../../../../../src/hooks/useSubjects';
import { useSubscriptionGate } from '../../../../../src/hooks/useSubscriptionGate';
import { useExamsUsedToday } from '../../../../../src/hooks/useExamsUsedToday';
import { SUBJECT_LEVELS, LEVEL_UNLOCK_THRESHOLD } from '@kd/shared';
import type { LevelProgress, SubjectLevel } from '@kd/shared';
// FIX TD1: Use shared constants instead of inline duplicates
import { LEVEL_COLOURS } from '../../../../../src/utils/constants';

// ─── Level config ─────────────────────────────────────────────

const LEVEL_ICONS: Record<SubjectLevel, string> = {
  Beginner:  'leaf-outline',
  Rookie:    'rocket-outline',
  Skilled:   'flash-outline',
  Competent: 'trophy-outline',
  Expert:    'star-outline',
  Master:    'diamond-outline',
};

// ─── Single topic accordion ──────────────────────────────────

function TopicAccordion({
  examId, subjectId, subjectName: _subjectName, topic, router, tournamentId,
  // FIX PF3: Accept gate props from parent instead of calling hooks per-accordion
  isLevelTierLocked, isDailyLimitReached: dailyLimitReached, goToUpgrade,
}: {
  examId: string; subjectId: string; subjectName: string;
  topic: { slug: string; displayName: string };
  router: ReturnType<typeof useRouter>;
  tournamentId?: string;
  isLevelTierLocked: (idx: number) => boolean;
  isDailyLimitReached: boolean;
  goToUpgrade: () => void;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  // Only fetch level summary when expanded (saves API calls)
  const { data: summary, isLoading } = useSubjectLevelSummary(
    open ? examId : '',
    open ? subjectId : '',
    open ? topic.slug : '',
  );

  const hasTierLockedLevels = SUBJECT_LEVELS.some((_: SubjectLevel, idx: number) => isLevelTierLocked(idx));

  function handleLevelPress(level: LevelProgress, levelIndex: number) {
    if (isLevelTierLocked(levelIndex)) { goToUpgrade(); return; }
    if (!level.isUnlocked || dailyLimitReached) return;

    const queryParams = new URLSearchParams({
      examId,
      subjectId,
      level: level.level,
      topicSlug: topic.slug,
      title: `${topic.displayName} — ${level.level}`,
      ...(tournamentId ? { tournamentId } : {}),
    }).toString();
    router.push(`/flashcards/subject-level?${queryParams}`);
  }

  return (
    <View style={{
      backgroundColor: theme.card,
      borderRadius: radius['2xl'],
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    }}>
      {/* Topic header */}
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'center',
          padding: spacing.lg, gap: spacing.md,
        }}
      >
        <View style={{
          width: 36, height: 36, borderRadius: radius.full,
          backgroundColor: theme.primary + '18',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="book-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="label">{topic.displayName}</Typography>
          {!open && summary && (
            <Typography variant="caption" color={theme.textTertiary}>
              {summary.levels.filter(l => l.isUnlocked).length}/6 levels unlocked
            </Typography>
          )}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18} color={theme.textTertiary}
        />
      </TouchableOpacity>

      {/* Expanded level rows */}
      {open && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
          {isLoading ? (
            <>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} height={70} borderRadius={radius.xl} />
              ))}
            </>
          ) : summary ? (
            summary.levels.map((level: LevelProgress, levelIndex: number) => {
              const tierLocked = isLevelTierLocked(levelIndex);
              const progressLocked = !level.isUnlocked;
              const isLocked = tierLocked || progressLocked;
              const colour = LEVEL_COLOURS[levelIndex] ?? theme.primary;
              const progress = Math.min(level.correctAnswers / LEVEL_UNLOCK_THRESHOLD, 1);
              const icon: string = LEVEL_ICONS[level.level] ?? 'help-circle-outline';

              return (
                <TouchableOpacity
                  key={level.level}
                  onPress={() => handleLevelPress(level, levelIndex)}
                  activeOpacity={isLocked ? 1 : 0.75}
                  style={{
                    backgroundColor: theme.background,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: tierLocked
                      ? theme.border
                      : level.isCompleted
                        ? colour
                        : level.isUnlocked
                          ? colour + '55'
                          : theme.border,
                    gap: spacing.xs,
                    opacity: progressLocked && !tierLocked ? 0.55 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View
                      style={{
                        width: 40, height: 40, borderRadius: radius.full,
                        backgroundColor: isLocked ? theme.cardAlt : colour + '22',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={(isLocked
                          ? tierLocked ? 'star-outline' : 'lock-closed-outline'
                          : icon) as never}
                        size={18}
                        color={isLocked ? theme.textTertiary : colour}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Typography variant="label">{level.level}</Typography>
                      <Typography variant="caption" color={theme.textTertiary}>
                        {tierLocked
                          ? '⭐ Upgrade required'
                          : progressLocked
                            ? '🔒 Complete previous level'
                            : level.isCompleted
                              ? '✓ Completed'
                              : `${level.correctAnswers}/${LEVEL_UNLOCK_THRESHOLD} correct`}
                      </Typography>
                      {!isLocked && level.totalAnswers > 0 && (
                        <Typography variant="caption" color={colour} style={{ fontSize: 10 }}>
                          {Math.round((level.correctAnswers / level.totalAnswers) * 100)}% accuracy
                        </Typography>
                      )}
                    </View>

                    {!progressLocked && !dailyLimitReached && (
                      <Ionicons
                        name={tierLocked ? 'arrow-up-circle-outline' : 'chevron-forward'}
                        size={18}
                        color={tierLocked ? theme.primary : theme.textTertiary}
                      />
                    )}
                  </View>

                  {!tierLocked && level.isUnlocked && !level.isCompleted && (
                    <ProgressBar progress={progress} height={5} />
                  )}
                </TouchableOpacity>
              );
            })
          ) : null}

          {hasTierLockedLevels && (
            <View style={{ marginTop: spacing.xs }}>
              <LockedFeatureBanner
                feature="Upgrade to unlock Expert & Master levels"
                minTier={2}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function LevelsScreen() {
  const { examId, subjectId, title, tournamentId } = useLocalSearchParams<{
    examId: string;
    subjectId: string;
    title?: string;
    tournamentId?: string;
  }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { isLevelTierLocked, isDailyLimitReached, goToUpgrade } = useSubscriptionGate();
  const { examsUsedToday } = useExamsUsedToday();
  const dailyLimitReached = isDailyLimitReached(examsUsedToday);

  const subjectName = title ?? 'Subject';

  // Dynamic topic loading from API
  const { data: topics, isLoading: topicsLoading } = useSubjectTopics(subjectId);

  return (
    <ScreenWrapper>
      <Header showBack title={`${subjectName} — Topics`} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {dailyLimitReached && (
          <DailyLimitBanner examsUsedToday={examsUsedToday} limitReached={true} />
        )}

        <Typography variant="bodySmall" color={theme.textTertiary}>
          Choose a topic, then select a difficulty level to start studying.
        </Typography>

        {topicsLoading ? (
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
            {[0, 1, 2, 3, 4].map(i => (
              <Skeleton key={i} height={60} borderRadius={radius['2xl']} />
            ))}
          </View>
        ) : !topics || topics.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
            <Typography variant="body" color={theme.textTertiary} align="center" style={{ marginTop: spacing.md }}>
              No topics found for "{subjectName}".{'\n'}Topics will appear once they are added by an admin.
            </Typography>
          </View>
        ) : (
          topics.map((topic) => (
            <TopicAccordion
              key={topic.slug}
              examId={examId}
              subjectId={subjectId}
              subjectName={subjectName}
              topic={topic}
              router={router}
              tournamentId={tournamentId}
              isLevelTierLocked={isLevelTierLocked}
              isDailyLimitReached={dailyLimitReached}
              goToUpgrade={goToUpgrade}
            />
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
