// ─── Home Dashboard — Personalized ───────────────────────────
// Shows context-aware content based on the user's onboarding
// selections (selectedExams + selectedSubjects).
// Falls back to generic "Explore Exams" for unonboarded users.

import { useEffect, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Divider } from '../../src/components/ui/Divider';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { ExamCard } from '../../src/components/ExamCard';
import { ActivityItem } from '../../src/components/ActivityItem';
import { StudyInsightsCard } from '../../src/components/StudyInsightsCard';
import { TargetSubjectCard, SUBJECT_ACCENT_PALETTE, getSubjectIcon } from '../../src/components/TargetSubjectCard';
import { UpNextHeroCard } from '../../src/components/UpNextHeroCard';

import { WeeklyHeatmap } from '../../src/components/WeeklyHeatmap';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useSubscription } from '../../src/contexts/SubscriptionContext';
import { useProgressSummary, useStudyStreak } from '../../src/hooks/useProgress';
import { useCoinBalance } from '../../src/hooks/useGamification';
import { useExams } from '../../src/hooks/useExams';
import { fetchRecentSessions, fetchLevelProgressSummary } from '../../src/services/api-contracts';
import { formatRelativeTime } from '../../src/utils/time';
import { api } from '../../src/services/api';
import type { Subject } from '@kd/shared';

const FREE_EXAM_PREVIEW = 3;
const RECENT_ACTIVITY_LIMIT = 3;

// ─── Greeting ────────────────────────────────────────────────
function getGreeting(name: string) {
  const first = name.split(' ')[0];
  const hour = new Date().getHours();
  const time = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${time}, ${first}`;
}

function getSubtitle(examName?: string, streak?: number) {
  if (streak && streak >= 7) return `🔥 ${streak}-day streak — keep it going!`;
  if (streak && streak >= 3) return `${streak} days strong 💪`;
  if (examName) return `Ready to conquer ${examName}?`;
  return 'Ready to study today?';
}

// ─── Shimmer upgrade pill ─────────────────────────────────────
function UpgradePill({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const shimmerOpacity = useSharedValue(0);

  useEffect(() => {
    shimmerOpacity.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(0, { duration: 600 }),
          withTiming(0, { duration: 1800 }),
        ),
        -1,
      ),
    );
  }, [shimmerOpacity]);

  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmerOpacity.value }));

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Upgrade your subscription"
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: theme.primary + '33',
        overflow: 'hidden',
      }}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          shimmerStyle,
          {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.35)',
            borderRadius: radius.full,
          },
        ]}
        pointerEvents="none"
      />
      <Ionicons name="rocket-outline" size={12} color={theme.primary} />
      <Typography variant="captionBold" color={theme.primary}>PRO</Typography>
    </TouchableOpacity>
  );
}

// ─── Staggered fade-in wrapper ────────────────────────────────
function FadeInView({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    translateY.value = withDelay(delay, withSpring(0, { stiffness: 140, damping: 20 }));
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── Weekly heatmap helper ────────────────────────────────────
function getWeekStudyData(lastStudyDate?: string): { studiedDays: boolean[]; todayIndex: number } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0=Mon

  // For now, mark today as studied if lastStudyDate is today
  const todayStr = now.toISOString().split('T')[0];
  const studiedToday = lastStudyDate === todayStr;

  // Build array — we only reliably know about today from the streak hook
  const studiedDays = Array(7).fill(false);
  if (studiedToday) studiedDays[todayIndex] = true;

  return { studiedDays, todayIndex };
}

// ─── Screen ───────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user, preferences } = useAuth();
  const router = useRouter();
  const { isSubscribed, goToUpgrade } = useSubscriptionGate();
  const { subscription } = useSubscription();

  const trialExpired =
    subscription != null &&
    !subscription.isActive &&
    (subscription.status === 'expired' || subscription.status === 'canceled');

  const displayName = user?.displayName ?? 'Learner';

  // ─── Onboarding preferences ──────────────────────────────
  const selectedSubjectIds: string[] = preferences?.selectedSubjects ?? [];
  const selectedExamIds: string[] = preferences?.selectedExams ?? [];
  const isOnboarded = selectedSubjectIds.length > 0;

  // Primary exam ID for deep-linking (first selected exam)
  const primaryExamId = selectedExamIds[0] ?? '';

  // ─── Fetch the full Subject objects for onboarded users ───
  const { data: personalizedSubjects, isLoading: subjectsLoading } = useQuery<Subject[]>({
    queryKey: ['home-personalized-subjects', selectedSubjectIds.join(',')],
    queryFn: async () => {
      const requests = selectedExamIds.map((id) => api.get(`/exams/${id}/subjects`));
      const responses = await Promise.all(requests);
      const map = new Map<string, Subject>();
      for (const res of responses) {
        if (res.data?.success && res.data.data) {
          for (const s of res.data.data as Subject[]) {
            if (selectedSubjectIds.includes(s.id)) {
              map.set(s.id, s);
            }
          }
        }
      }
      return selectedSubjectIds.map((id) => map.get(id)).filter((s): s is Subject => !!s);
    },
    enabled: isOnboarded && selectedExamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Mastery data: correctAnswers + levelIndex per subject ───
  const { data: levelProgress } = useQuery({
    queryKey: ['home-level-progress-summary'],
    queryFn: fetchLevelProgressSummary,
    staleTime: 60_000,
    enabled: isOnboarded,
  });

  const masteryMap = new Map<string, { correctAnswers: number; levelIndex: number }>();
  if (levelProgress) {
    for (const item of levelProgress) {
      masteryMap.set(item.subjectId, {
        correctAnswers: item.correctAnswers,
        levelIndex: item.levelIndex,
      });
    }
  }

  // ─── "Up Next" = first subject with no progress yet ───────
  const upNextSubject = personalizedSubjects?.find((s) => !masteryMap.has(s.id))
    ?? personalizedSubjects?.[0];

  // ─── Exam names for greeting ───────────────────────────────
  const { data: examsPages, isLoading: examsLoading } = useExams(10);
  const exams = examsPages?.pages?.flatMap((p) => p.data) ?? [];
  const primaryExam = exams.find((e) => selectedExamIds.includes(e.id));

  // ─── Real data hooks ─────────────────────────────────────
  const { data: coinData } = useCoinBalance();
  const { data: streakData } = useStudyStreak();
  const { data: progressData } = useProgressSummary();
  const { data: activityData } = useQuery({
    queryKey: ['progress-history-home'],
    queryFn: () => fetchRecentSessions(RECENT_ACTIVITY_LIMIT),
    staleTime: 60_000,
  });

  const coins = coinData?.balance ?? 0;
  const streak = streakData?.currentStreak ?? 0;
  const solved = progressData?.totalCardsCompleted ?? 0;
  const studiedToday = streakData?.lastStudyDate === new Date().toISOString().split('T')[0];

  const lastSession = activityData?.[0];

  // ─── Weekly heatmap data ─────────────────────────────────
  const weekData = useMemo(
    () => getWeekStudyData(streakData?.lastStudyDate),
    [streakData?.lastStudyDate],
  );


  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ━━━ Header ━━━ */}
        <View
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.sm,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Typography variant="h3" numberOfLines={1}>
              {getGreeting(displayName)}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: 2 }}>
              {getSubtitle(primaryExam?.title, streak)}
            </Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <CoinDisplay coins={coins} size="sm" />
            {!isSubscribed && <UpgradePill onPress={goToUpgrade} />}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] }}>

          {/* ━━━ Trial Expiry Banner ━━━ */}
          {trialExpired && (
            <FadeInView delay={0}>
              <TouchableOpacity
                onPress={goToUpgrade}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Your free trial ended. Upgrade to continue."
                style={{
                  backgroundColor: theme.primaryMuted,
                  borderRadius: radius['2xl'],
                  borderWidth: 1.5, borderColor: theme.primary + '44',
                  padding: spacing.lg,
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                }}
              >
                <Ionicons name="rocket-outline" size={24} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color={theme.primary}>Your free trial ended</Typography>
                  <Typography variant="caption" color={theme.textSecondary}>
                    Keep learning — upgrade to continue your progress
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </FadeInView>
          )}

          {/* ━━━ Resume CTA — most actionable item ━━━ */}
          {lastSession && (
            <FadeInView delay={60}>
              {isSubscribed ? (
                <TouchableOpacity
                  onPress={() => router.push(`/flashcards/${lastSession.deckId}`)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`Resume studying ${lastSession.deckTitle}`}
                  style={{
                    backgroundColor: theme.primary, borderRadius: radius['2xl'],
                    padding: spacing.lg, gap: spacing.sm,
                    flexDirection: 'row', alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Typography variant="overline" color="rgba(255,255,255,0.65)">Continue</Typography>
                    <Typography variant="h4" color="#FFFFFF" numberOfLines={1} style={{ fontWeight: '700' }}>
                      {lastSession.deckTitle}
                    </Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.7)">
                      {lastSession.cardsStudied} cards · {Math.round((lastSession.correctAnswers / Math.max(lastSession.cardsStudied, 1)) * 100)}% correct
                    </Typography>
                  </View>
                  <View
                    style={{
                      width: 48, height: 48, borderRadius: radius.full,
                      backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="play" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={goToUpgrade}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Resume Studying. Upgrade to Basic to pick up where you left off."
                  style={{
                    backgroundColor: theme.primaryMuted,
                    borderRadius: radius['2xl'],
                    borderWidth: 1.5, borderColor: theme.primary + '44',
                    padding: spacing.lg,
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: radius.full,
                      backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: theme.primary + '44',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="lock-closed" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Typography variant="label" color={theme.primary}>Resume Studying</Typography>
                    <Typography variant="caption" color={theme.textSecondary}>
                      Upgrade to pick up where you left off
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </TouchableOpacity>
              )}
            </FadeInView>
          )}


          {/* ━━━ Weekly Heatmap ━━━ */}
          <FadeInView delay={180}>
            <WeeklyHeatmap
              studiedDays={weekData.studiedDays}
              todayIndex={weekData.todayIndex}
              streak={streak}
            />
          </FadeInView>

          {/* ━━━ Study Insight (contextual tip) ━━━ */}
          <FadeInView delay={240}>
            <StudyInsightsCard data={{
              streak,
              freezes: streakData?.streakFreezes ?? 0,
              accuracy: progressData?.overallAccuracy ?? null,
              studiedToday,
            }} />
          </FadeInView>

          {/* ══════════════════════════════════════════════════════
              PERSONALIZED SECTIONS — only shown if onboarded
          ══════════════════════════════════════════════════════ */}
          {isOnboarded ? (
            <>
              {/* ━━━ "Up Next for You" hero card ━━━ */}
              {upNextSubject && (() => {
                const upNextAccentIdx = Math.max(0, personalizedSubjects?.findIndex(s => s.id === upNextSubject.id) ?? 0);
                const upNextAccent = SUBJECT_ACCENT_PALETTE[upNextAccentIdx % SUBJECT_ACCENT_PALETTE.length]!;
                const upNextStage = Math.min(
                  masteryMap.get(upNextSubject.id)?.levelIndex ?? 0,
                  4,
                );
                return (
                  <FadeInView delay={300}>
                    <UpNextHeroCard
                      subjectName={upNextSubject.name}
                      examName={primaryExam?.title}
                      description={upNextSubject.description}
                      accentColor={upNextAccent.bg}
                      gradientColors={upNextAccent.grad}
                      icon={(upNextSubject.iconName as never) || getSubjectIcon(upNextSubject.name)}
                      currentStage={upNextStage}
                      onStart={() =>
                        router.push(
                          `/exams/${primaryExamId}/subjects/${upNextSubject.id}/levels?title=${encodeURIComponent(upNextSubject.name)}` as never,
                        )
                      }
                    />
                  </FadeInView>
                );
              })()}

              {/* ━━━ "Your Target Subjects" carousel ━━━ */}
              <View style={{ gap: spacing.md }}>
                <FadeInView delay={360}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h4">Your Subjects</Typography>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/study')} accessibilityRole="link" accessibilityLabel="See all target subjects">
                      <Typography variant="label" color={theme.primary}>See all</Typography>
                    </TouchableOpacity>
                  </View>
                </FadeInView>

                {subjectsLoading ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl }}>
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} width={170} height={180} borderRadius={radius['2xl']} />
                      ))}
                    </View>
                  </ScrollView>
                ) : personalizedSubjects && personalizedSubjects.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -spacing.xl }}
                    contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }}
                  >
                    {personalizedSubjects.map((subject, idx) => (
                      <TargetSubjectCard
                        key={subject.id}
                        subject={subject}
                        accentIndex={idx}
                        correctAnswers={masteryMap.get(subject.id)?.correctAnswers ?? 0}
                        levelIndex={masteryMap.get(subject.id)?.levelIndex ?? 0}
                        animDelay={360 + idx * 80}
                        onPress={() =>
                          router.push(
                            `/exams/${primaryExamId}/subjects/${subject.id}/levels?title=${encodeURIComponent(subject.name)}` as never,
                          )
                        }
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </>
          ) : (
            /* ━━━ GENERIC: Explore Exams (unonboarded users) ━━━ */
            <FadeInView delay={300}>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h4">Explore Exams</Typography>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/study')} accessibilityRole="link" accessibilityLabel="See all exams">
                    <Typography variant="label" color={theme.primary}>See all</Typography>
                  </TouchableOpacity>
                </View>
                {examsLoading ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl }}>
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} width={180} height={140} borderRadius={radius.xl} />
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl }}>
                      {(exams ?? []).map((exam, idx) => {
                        const isLocked = !isSubscribed && idx >= FREE_EXAM_PREVIEW;
                        return (
                          <ExamCard
                            key={exam.id}
                            name={exam.title}
                            count={exam.questionCount ?? 0}
                            progress={0}
                            icon={isLocked ? 'lock-closed-outline' : 'library-outline'}
                            accent={isLocked ? theme.textTertiary : theme.statSolved}
                            onPress={isLocked
                              ? () => router.push('/subscription')
                              : () => router.push(`/exams/${exam.id}/subjects?title=${encodeURIComponent(exam.title)}` as never)
                            }
                            style={{ width: 180, opacity: isLocked ? 0.55 : 1 }}
                          />
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>
            </FadeInView>
          )}

          {/* ━━━ Recent Activity ━━━ */}
          {activityData && activityData.length > 0 ? (
            <FadeInView delay={isOnboarded ? 440 : 360}>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h4">Recent Activity</Typography>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/progress')} accessibilityRole="link" accessibilityLabel="View all activity">
                    <Typography variant="label" color={theme.primary}>View all</Typography>
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: radius.xl,
                    paddingHorizontal: spacing.base,
                    overflow: 'hidden',
                  }}
                >
                  {activityData.slice(0, RECENT_ACTIVITY_LIMIT).map((item, idx) => (
                    <View key={`${item.deckId}-${idx}`}>
                      <ActivityItem
                        examName={item.deckTitle}
                        cardsStudied={item.cardsStudied}
                        accuracy={Math.round((item.correctAnswers / Math.max(item.cardsStudied, 1)) * 100)}
                        timeAgo={formatRelativeTime(item.endedAt)}
                        icon="library-outline"
                      />
                      {idx < Math.min(activityData.length, RECENT_ACTIVITY_LIMIT) - 1 && (
                        <Divider style={{ marginVertical: 0 }} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </FadeInView>
          ) : solved === 0 ? (
            /* ━━━ Smart empty state ━━━ */
            <FadeInView delay={isOnboarded ? 440 : 360}>
              <View
                style={{
                  alignItems: 'center', gap: spacing.lg,
                  padding: spacing['2xl'],
                  backgroundColor: theme.cardAlt, borderRadius: radius['2xl'],
                }}
              >
                <View
                  style={{
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: theme.primaryMuted,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="book-outline" size={28} color={theme.primary} />
                </View>
                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  {isOnboarded ? (
                    <>
                      <Typography variant="h4" align="center">
                        Let's establish your baseline
                      </Typography>
                      <Typography variant="body" color={theme.textSecondary} align="center">
                        You've picked your subjects — answer a few questions to see where you stand and unlock personalised recommendations.
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="h4" align="center">Start your journey</Typography>
                      <Typography variant="body" color={theme.textSecondary} align="center">
                        Pick an exam above and complete your first study session to see your progress here.
                      </Typography>
                    </>
                  )}
                </View>
                <Button
                  onPress={() => router.push(isOnboarded ? '/(tabs)/study' : '/explore-exams')}
                  variant="primary"
                  size="sm"
                >
                  {isOnboarded ? 'Take a Baseline Quiz' : 'Browse Exams'}
                </Button>
              </View>
            </FadeInView>
          ) : null}

        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
