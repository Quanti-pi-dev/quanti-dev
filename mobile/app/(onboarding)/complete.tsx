// ─── Onboarding: Personalized Profile Reveal ─────────────────
// Final step: Replaces the generic "You're all set" screen with
// a dynamic, personalized learning profile reveal that shows
// real stats from the mini-session and a computed study plan.
//
// Phase 1: Shows exam countdown, daily target, streak start,
// coins earned, and mini-session accuracy — all animated in
// with staggered reveals to create a "build-up" moment.
//
// Phase 4: Adds AI-powered study plan narrative with typing
// animation, "Invite a Study Buddy" CTA, and daily chest prompt.

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { View, Dimensions, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { InviteBuddyCTA } from '../../src/components/onboarding/InviteBuddyCTA';
// FIX B8: Use static import instead of dynamic import
import { api } from '../../src/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Confetti Particle ──────────────────────────────────────
const CONFETTI_COLORS = ['#60A5FA', '#F59E0B', '#34D399', '#F87171', '#A78BFA', '#FB923C'];

function ConfettiParticle({ delay, color, startX, startY }: { delay: number; color: string; startX: number; startY: number }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Fade in
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1800, withTiming(0, { duration: 600 })),
    ));
    // Scale up
    scale.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) }),
      withDelay(1500, withTiming(0, { duration: 500 })),
    ));
    // Fall down
    translateY.value = withDelay(delay,
      withTiming(200 + Math.random() * 150, { duration: 2500, easing: Easing.in(Easing.quad) }),
    );
    // Drift sideways
    translateX.value = withDelay(delay,
      withTiming((Math.random() - 0.5) * 120, { duration: 2500, easing: Easing.out(Easing.ease) }),
    );
    // Spin
    rotate.value = withDelay(delay,
      withRepeat(
        withTiming(360, { duration: 1000 + Math.random() * 1000 }),
        3,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          left: startX,
          top: startY,
          width: 8,
          height: 8,
          borderRadius: Math.random() > 0.5 ? 4 : 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

// ─── Profile Stat Row ───────────────────────────────────────
function ProfileStatRow({
  icon,
  emoji,
  label,
  value,
  valueColor,
  delay,
}: {
  icon?: string;
  emoji?: string;
  label: string;
  value: string;
  valueColor?: string;
  delay: number;
}) {
  const { theme, isDark } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {emoji ? (
          <Typography style={{ fontSize: 18 }}>{emoji}</Typography>
        ) : (
          <Ionicons name={icon as never} size={18} color={theme.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="caption" color={theme.textTertiary}>{label}</Typography>
        <Typography variant="bodySemiBold" color={valueColor ?? theme.text}>{value}</Typography>
      </View>
    </Animated.View>
  );
}

// ─── AI Study Plan Narrative (with typing effect) ───────────
function AIStudyPlanNarrative({
  examId,
  subjects,
  examDate,
  studyPersonality,
  dailyCardTarget,
  delay,
}: {
  examId: string;
  subjects: string[];
  examDate?: string;
  studyPersonality?: string;
  dailyCardTarget?: number;
  delay: number;
}) {
  const { theme, isDark } = useTheme();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Fetch AI study plan on mount
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await api.post<{
          success: boolean;
          data: { narrative: string; source: string };
        }>('/ai/study-plan-preview', {
          examId,
          subjects,
          examDate,
          studyPersonality,
          dailyCardTarget,
        });

        if (!cancelled && response.data?.data?.narrative) {
          setNarrative(response.data.data.narrative);
        }
      } catch {
        // AI unavailable — don't show anything (non-critical)
      }
    }, delay); // Delay the API call to match animation timing

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Typing animation effect
  useEffect(() => {
    if (!narrative) return;
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i <= narrative.length) {
        setDisplayedText(narrative.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 20); // 20ms per character — feels fast but readable

    return () => clearInterval(interval);
  }, [narrative]);

  if (!narrative) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={{
        backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="sparkles" size={16} color="#6366F1" />
        <Typography variant="caption" color="#6366F1">
          AI Study Coach
        </Typography>
      </View>
      <Typography
        variant="body"
        color={theme.textSecondary}
        style={{ lineHeight: 22 }}
      >
        {displayedText}
        {isTyping && (
          <Typography color={theme.primary}>|</Typography>
        )}
      </Typography>
    </Animated.View>
  );
}

// ─── Daily Chest Prompt ─────────────────────────────────────
function DailyChestPrompt({ delay }: { delay: number }) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.05)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography style={{ fontSize: 18 }}>🎁</Typography>
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="bodySemiBold" color="#F59E0B">
          Your first Daily Chest is waiting!
        </Typography>
        <Typography variant="caption" color={theme.textTertiary}>
          Open it on your home screen for bonus rewards
        </Typography>
      </View>
    </Animated.View>
  );
}

export default function OnboardingCompleteScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { user, refreshUser, preferences } = useAuth();
  const {
    examIds,
    selectedSubjects,
    examDate,
    preferredStudyTime,
    dailyCardTarget,
    miniSessionCorrect,
    miniSessionTotal,
    miniSessionCoins,
    // Phase 3: personality quiz results
    studyPersonality,
    motivationType,
    sessionPreference,
  } = useLocalSearchParams<{
    examIds?: string;
    selectedSubjects?: string;
    examDate?: string;
    preferredStudyTime?: string;
    dailyCardTarget?: string;
    miniSessionCorrect?: string;
    miniSessionTotal?: string;
    miniSessionCoins?: string;
    studyPersonality?: string;
    motivationType?: string;
    sessionPreference?: string;
  }>();

  const displayName = user?.displayName?.split(' ')[0] ?? 'there';

  // Parse mini-session results
  const correctCount = parseInt(miniSessionCorrect ?? '0', 10);
  const totalCount = parseInt(miniSessionTotal ?? '0', 10);
  const coinsEarned = parseInt(miniSessionCoins ?? '0', 10);
  const hadMiniSession = totalCount > 0;

  // Compute days remaining
  const daysRemaining = useMemo(() => {
    if (!examDate) return null;
    const exam = new Date(examDate);
    const now = new Date();
    const diff = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1);
  }, [examDate]);

  const dailyTarget = parseInt(dailyCardTarget ?? '0', 10);

  // Count selected exams and subjects
  const examCount = preferences?.selectedExams?.length ?? 0;
  const subjectCount = preferences?.selectedSubjects?.length ?? 0;

  // Parse subject IDs for AI study plan
  const subjectIdArray = useMemo(
    () => selectedSubjects?.split(',').filter(Boolean) ?? [],
    [selectedSubjects],
  );
  const examIdArray = useMemo(
    () => examIds?.split(',').filter(Boolean) ?? [],
    [examIds],
  );

  // Animated checkmark scale pulse
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSequence(
      withTiming(1.3, { duration: 400, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 300 }),
    );
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Generate confetti particles
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        delay: 300 + i * 80,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#60A5FA',
        startX: (SCREEN_WIDTH * 0.1) + (Math.random() * SCREEN_WIDTH * 0.8),
        startY: SCREEN_HEIGHT * 0.05 + Math.random() * 60,
      })),
    [],
  );

  // Mark onboarding as completed + save exam goal data + award starter pack
  useEffect(() => {
    (async () => {
      try {
        const goalData: Record<string, unknown> = { onboardingCompleted: true };
        if (examDate) goalData.examDate = examDate;
        if (preferredStudyTime) goalData.preferredStudyTime = preferredStudyTime;
        if (dailyCardTarget) goalData.dailyCardTarget = parseInt(dailyCardTarget, 10);
        // Phase 3: Persist personality quiz results
        if (studyPersonality) goalData.studyPersonality = studyPersonality;
        if (motivationType) goalData.motivationType = motivationType;
        if (sessionPreference) goalData.sessionPreference = sessionPreference;
        await api.put('/users/preferences', goalData);

        // Phase 2: Award full starter pack (10 coins + streak freeze + badge)
        // Idempotent — safe to call even if student revisits this screen
        await api.post('/gamify/starter-pack').catch(() => {
          // Non-critical — coins were already awarded in mini-session
        });

        await refreshUser();
      } catch {
        // Non-critical — onboarding layout guard will handle on next launch
      }
    })();
  }, []);

  // FIX B9: Wrap in useCallback so auto-navigate timer uses latest reference
  const handleContinue = useCallback(() => {
    router.replace('/(tabs)' as never);
  }, [router]);

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Subtle gradient background */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(52,211,153,0.06)', 'transparent', 'rgba(96,165,250,0.06)']
              : ['rgba(16,185,129,0.04)', 'transparent', 'rgba(37,99,235,0.03)']
          }
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Confetti burst */}
        {confetti.map((c) => (
          <ConfettiParticle
            key={c.id}
            delay={c.delay}
            color={c.color}
            startX={c.startX}
            startY={c.startY}
          />
        ))}

        <ScrollView
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
            paddingBottom: spacing['2xl'],
            gap: spacing.lg,
            minHeight: SCREEN_HEIGHT * 0.85,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Animated checkmark with glow */}
          <Animated.View
            style={[
              checkStyle,
              {
                width: 90,
                height: 90,
                borderRadius: 45,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: theme.success,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 24,
                elevation: 16,
                overflow: 'hidden',
              },
            ]}
          >
            <LinearGradient
              colors={[theme.success, '#10B981', '#059669']}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="checkmark" size={48} color="#FFFFFF" />
          </Animated.View>

          {/* Title */}
          <View style={{ gap: spacing.xs, alignItems: 'center' }}>
            <Animated.View entering={FadeInDown.delay(500).duration(500).springify()}>
              <Typography variant="h2" align="center">
                Your Profile is Ready! 🎉
              </Typography>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(700).duration(400)}>
              <Typography variant="body" align="center" color={theme.textSecondary}>
                Here's your personalized study plan, {displayName}.
              </Typography>
            </Animated.View>
          </View>

          {/* Personalized stat rows */}
          <View style={{ width: '100%', gap: spacing.sm }}>
            {/* Mini-session results */}
            {hadMiniSession && (
              <ProfileStatRow
                emoji="🧠"
                label="First challenge"
                value={`${correctCount}/${totalCount} correct — ${correctCount === totalCount ? 'perfect!' : 'great start!'}`}
                valueColor={correctCount === totalCount ? '#10B981' : theme.primary}
                delay={900}
              />
            )}

            {/* Exam countdown */}
            {daysRemaining && (
              <ProfileStatRow
                emoji="📅"
                label="Until your exam"
                value={`${daysRemaining} days — we've got time`}
                delay={1000}
              />
            )}

            {/* Study personality type */}
            {studyPersonality && (
              <ProfileStatRow
                emoji="🧬"
                label="Your study type"
                value={studyPersonality}
                valueColor="#8B5CF6"
                delay={1050}
              />
            )}

            {/* Daily target */}
            {dailyTarget > 0 && (
              <ProfileStatRow
                emoji="📚"
                label="Daily target to stay on track"
                value={`~${dailyTarget} cards/day`}
                valueColor={theme.primary}
                delay={1100}
              />
            )}

            {/* Streak start */}
            <ProfileStatRow
              emoji="🔥"
              label="Day 1 streak"
              value="Your streak starts today!"
              valueColor="#EF4444"
              delay={1200}
            />

            {/* Coins earned (mini-session 5 + starter pack 10) */}
            <ProfileStatRow
              emoji="💰"
              label="Starter coins"
              value={`+${coinsEarned + 10} coins — spend them in the shop`}
              valueColor="#F59E0B"
              delay={1300}
            />

            {/* Starter pack: Streak freeze */}
            <ProfileStatRow
              emoji="🛡️"
              label="Streak freeze"
              value="1 free freeze — protects your streak"
              valueColor="#60A5FA"
              delay={1400}
            />

            {/* Starter pack: First Steps badge */}
            <ProfileStatRow
              emoji="🏅"
              label="Badge unlocked"
              value="First Steps — your first achievement!"
              valueColor="#A78BFA"
              delay={1500}
            />
          </View>

          {/* Phase 4: AI Study Plan Narrative */}
          {examIdArray.length > 0 && subjectIdArray.length > 0 && (
            <View style={{ width: '100%' }}>
              <AIStudyPlanNarrative
                examId={examIdArray[0]!}
                subjects={subjectIdArray}
                examDate={examDate}
                studyPersonality={studyPersonality}
                dailyCardTarget={dailyTarget > 0 ? dailyTarget : undefined}
                delay={1600}
              />
            </View>
          )}

          {/* Phase 4: Daily Chest Prompt */}
          <View style={{ width: '100%' }}>
            <DailyChestPrompt delay={1800} />
          </View>

          {/* CTA */}
          <Animated.View entering={FadeInUp.delay(1900).duration(400)} style={{ width: '100%' }}>
            <Button
              fullWidth
              size="lg"
              onPress={handleContinue}
              icon={<Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />}
              iconPosition="right"
            >
              Start Studying
            </Button>
          </Animated.View>

          {/* Phase 4: Invite a Study Buddy */}
          <View style={{ width: '100%' }}>
            <InviteBuddyCTA
              userId={user?.id}
              displayName={user?.displayName ?? undefined}
              delay={2100}
            />
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}
