// ─── Home Dashboard — Personalized ───────────────────────────
// Shows context-aware content based on the user's onboarding
// selections (selectedExams + selectedSubjects).
// Falls back to generic "Explore Exams" for unonboarded users.

import { useEffect } from 'react';
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
import { StatTile } from '../../src/components/StatTile';
import { ExamCard } from '../../src/components/ExamCard';
import { ActivityItem } from '../../src/components/ActivityItem';
import { StreakWidget } from '../../src/components/StreakWidget';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { StudyInsightsCard } from '../../src/components/StudyInsightsCard';
import { TargetSubjectCard, SUBJECT_ACCENT_PALETTE, getSubjectIcon } from '../../src/components/TargetSubjectCard';
import { UpNextHeroCard } from '../../src/components/UpNextHeroCard';
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

// ─── Greeting ────────────────────────────────────────────────
function getGreeting(name: string, streakDays?: number) {
  const first = name.split(' ')[0];
  if (streakDays && streakDays >= 7) return `🔥 ${streakDays}-day streak, ${first}!`;
  if (streakDays && streakDays >= 3) return `Keep it up, ${first}! ${streakDays} days 💪`;
  const hour = new Date().getHours();
  const time = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${time}, ${first} 👋`;
}

function getSubtitle(examName?: string) {
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
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
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
      <Ionicons name="rocket-outline" size={13} color={theme.primary} />
      <Typography variant="captionBold" color={theme.primary}>Upgrade</Typography>
    </TouchableOpacity>
  );
}

// ─── Staggered fade-in wrapper ────────────────────────────────
function FadeInView({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withSpring(0, { stiffness: 120, damping: 18 }));
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── Daily Goals Mini-Strip ───────────────────────────────────
interface GoalItem {
  icon: keyof typeof Ionicons['glyphMap'];
  label: string;
  done: boolean;
  color: string;
}

function DailyGoalStrip({ goals }: { goals: GoalItem[] }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Typography variant="label" color={theme.textTertiary}>Today's Goals</Typography>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {goals.map((g) => (
          <View
            key={g.label}
            style={{
              flex: 1,
              backgroundColor: g.done ? g.color + '18' : theme.cardAlt,
              borderRadius: radius.xl,
              borderWidth: 1.5,
              borderColor: g.done ? g.color + '44' : theme.border,
              padding: spacing.md,
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <View
              style={{
                width: 36, height: 36, borderRadius: radius.full,
                backgroundColor: g.done ? g.color + '28' : theme.border + '44',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {g.done ? (
                <Ionicons name="checkmark-circle" size={20} color={g.color} />
              ) : (
                <Ionicons name={g.icon} size={18} color={theme.textTertiary} />
              )}
            </View>
            <Typography
              variant="caption"
              align="center"
              color={g.done ? g.color : theme.textTertiary}
              style={{ lineHeight: 13 }}
            >
              {g.label}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
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
      // Fetch subjects from all selected exams and deduplicate
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
      // Preserve onboarding order
      return selectedSubjectIds.map((id) => map.get(id)).filter((s): s is Subject => !!s);
    },
    enabled: isOnboarded && selectedExamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Mastery data: levelIndex (0–5) per subject ───────────
  const { data: levelProgress } = useQuery({
    queryKey: ['home-level-progress-summary'],
    queryFn: fetchLevelProgressSummary,
    staleTime: 60_000,
    enabled: isOnboarded,
  });

  // Build a subjectId → progress (0–1) map from the level index (0=Beginner…5=Master)
  const masteryMap = new Map<string, number>();
  if (levelProgress) {
    for (const item of levelProgress) {
      // levelIndex 0–5 → 0–1 fraction
      masteryMap.set(item.subjectId, item.levelIndex / 5);
    }
  }

  // ─── "Up Next" = first subject with no progress yet ───────
  const upNextSubject = personalizedSubjects?.find((s) => !masteryMap.has(s.id))
    ?? personalizedSubjects?.[0];
  const upNextExamId = selectedExamIds[0] ?? '';

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
    queryFn: () => fetchRecentSessions(5),
    staleTime: 60_000,
  });

  const coins = coinData?.balance ?? 0;
  const streak = streakData?.currentStreak ?? 0;
  const solved = progressData?.totalCardsCompleted ?? 0;
  const accuracy = progressData?.overallAccuracy != null
    ? `${Math.round(progressData.overallAccuracy)}%`
    : '—';

  const lastSession = activityData?.[0];
  const studiedToday = streakData?.lastStudyDate === new Date().toISOString().split('T')[0];

  // ─── Daily goals ─────────────────────────────────────────
  const dailyGoals: GoalItem[] = [
    { icon: 'book-outline',      label: 'Study session', done: studiedToday,      color: '#6366F1' },
    { icon: 'flame-outline',     label: 'Keep streak',   done: studiedToday,      color: '#EF4444' },
    { icon: 'trophy-outline',    label: 'Earn 10 coins',  done: coins > 0,         color: '#F59E0B' },
  ];

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ─── Top bar ─── */}
        <View
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.sm,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Typography variant="h3" numberOfLines={1}>
              {getGreeting(displayName, streak)}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              {getSubtitle(primaryExam?.title)}
            </Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {!isSubscribed && <UpgradePill onPress={goToUpgrade} />}
            <CoinDisplay coins={coins} />
            <TouchableOpacity
              onPress={() => router.push('/shop')}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Open shop and coin wallet"
              style={{
                width: 44, height: 44, borderRadius: radius.full,
                backgroundColor: theme.cardAlt, borderWidth: 1.5, borderColor: theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="cart-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl, paddingBottom: spacing['3xl'] }}>

          {/* ─── Trial Expiry Banner ─── */}
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

          {/* ─── Streak ─── */}
          <FadeInView delay={60}>
            <StreakWidget streak={streak} freezes={streakData?.streakFreezes} />
          </FadeInView>

          {/* ─── Study Insights ─── */}
          <FadeInView delay={120}>
            <StudyInsightsCard data={{
              streak,
              freezes: streakData?.streakFreezes ?? 0,
              accuracy: progressData?.overallAccuracy ?? null,
              studiedToday: streakData?.lastStudyDate === new Date().toISOString().split('T')[0],
            }} />
          </FadeInView>

          {/* ─── Daily Goals ─── */}
          <FadeInView delay={160}>
            <DailyGoalStrip goals={dailyGoals} />
          </FadeInView>

          {/* ─── Stats Grid ─── */}
          <FadeInView delay={200}>
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label" color={theme.textTertiary}>Your stats</Typography>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatTile label="Solved" value={String(solved)} color={theme.statSolved} />
                <StatTile label="Accuracy" value={accuracy} color={theme.statAccuracy} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatTile label="Coins" value={coins.toLocaleString()} color={theme.statCoins} />
                <StatTile label="Streak" value={`${streak}d`} color={theme.statStreak} />
              </View>
            </View>
          </FadeInView>

          {/* ─── Resume CTA ─── */}
          {lastSession && (
            <FadeInView delay={240}>
              {isSubscribed ? (
                <View
                  style={{
                    backgroundColor: theme.primary, borderRadius: radius['2xl'],
                    padding: spacing.xl, gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: spacing.xs, flex: 1 }}>
                      <Typography variant="overline" color="rgba(255,255,255,0.7)">Continue where you left off</Typography>
                      <Typography variant="h4" color={theme.buttonPrimaryText}>{lastSession.deckTitle}</Typography>
                      <Typography variant="caption" color="rgba(255,255,255,0.7)">
                        {lastSession.cardsStudied} cards · {Math.round((lastSession.correctAnswers / Math.max(lastSession.cardsStudied, 1)) * 100)}% correct
                      </Typography>
                    </View>
                    <View
                      style={{
                        width: 52, height: 52, borderRadius: radius.full,
                        backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="play" size={22} color={theme.buttonPrimaryText} />
                    </View>
                  </View>
                  <Button
                    variant="ghost" size="sm"
                    onPress={() => router.push(`/flashcards/${lastSession.deckId}`)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start' }}
                  >
                    Resume Study
                  </Button>
                </View>
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
                      width: 44, height: 44, borderRadius: radius.full,
                      backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: theme.primary + '44',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="lock-closed" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Typography variant="label" color={theme.primary}>Resume Studying</Typography>
                    <Typography variant="caption" color={theme.textSecondary}>
                      Upgrade to Basic to pick up where you left off
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </TouchableOpacity>
              )}
            </FadeInView>
          )}

          {/* ══════════════════════════════════════════════════════
              PERSONALIZED SECTIONS — only shown if onboarded
          ══════════════════════════════════════════════════════ */}
          {isOnboarded ? (
            <>
              {/* ─── "Up Next for You" hero card ─── */}
              {upNextSubject && (() => {
                const upNextAccentIdx = personalizedSubjects?.findIndex(s => s.id === upNextSubject.id) ?? 0;
                const upNextAccent = SUBJECT_ACCENT_PALETTE[upNextAccentIdx % SUBJECT_ACCENT_PALETTE.length]!;
                const upNextStage = Math.min(
                  Math.floor((masteryMap.get(upNextSubject.id) ?? 0) * 5),
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
                      icon={getSubjectIcon(upNextSubject.name)}
                      currentStage={upNextStage}
                      onStart={() =>
                        router.push(
                          `/exams/${primaryExamId}/subjects?title=${encodeURIComponent(primaryExam?.title ?? '')}` as never,
                        )
                      }
                    />
                  </FadeInView>
                );
              })()}

              {/* ─── "Your Target Subjects" carousel ─── */}
              <View style={{ gap: spacing.md }}>
                <FadeInView delay={360}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h4">Your Target Subjects</Typography>
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
                        masteryProgress={masteryMap.get(subject.id) ?? 0}
                        animDelay={360 + idx * 80}
                        onPress={() =>
                          router.push(
                            `/exams/${primaryExamId}/subjects?title=${encodeURIComponent(primaryExam?.title ?? '')}` as never,
                          )
                        }
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </>
          ) : (
            /* ─── GENERIC: Explore Exams (unonboarded users) ─── */
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

          {/* ─── Recent Activity ─── */}
          {activityData && activityData.length > 0 ? (
            <FadeInView delay={isOnboarded ? 480 : 380}>
              <View style={{ gap: spacing.md }}>
                <Typography variant="h4">Recent Activity</Typography>
                <View style={{ gap: 0 }}>
                  {activityData.map((item, idx) => (
                    <View key={`${item.deckId}-${idx}`}>
                      <ActivityItem
                        examName={item.deckTitle}
                        cardsStudied={item.cardsStudied}
                        accuracy={Math.round((item.correctAnswers / Math.max(item.cardsStudied, 1)) * 100)}
                        timeAgo={formatRelativeTime(item.endedAt)}
                        icon="library-outline"
                      />
                      {idx < activityData.length - 1 && <Divider style={{ marginVertical: 0 }} />}
                    </View>
                  ))}
                </View>
              </View>
            </FadeInView>
          ) : solved === 0 ? (
            /* ─── Smart empty state ─── */
            <FadeInView delay={isOnboarded ? 480 : 380}>
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
                  onPress={() => router.push('/(tabs)/study')}
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
