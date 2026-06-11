// ─── TodaysStudyPlan ─────────────────────────────────────────
// Hero component for the analytics screen. Shows a personalized
// daily study prescription based on SM-2 memory model data.
// Free for all users.

import { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { useDailyPlanProgress, type SessionProgress } from '../../hooks/useDailyPlanProgress';
import type { DailyStudyPlan, PlannedStudySession, StudySessionReason } from '@kd/shared';

// ─── ML Constants ────────────────────────────────────────────

const MODEL_BADGE: Record<string, { label: string; color: string }> = {
  dkt:  { label: 'DKT',  color: '#6366F1' },
  sakt: { label: 'SAKT', color: '#8B5CF6' },
  bkt:  { label: 'BKT',  color: '#64748B' },
};

const DIFFICULTY_TO_LEVEL: Record<string, string> = {
  challenging: 'Advanced',
  moderate:    'Proficient',
  easy_review: 'Emerging',
};

// ─── Constants ────────────────────────────────────────────────

const REASON_CONFIG: Record<StudySessionReason, { icon: string; color: string; label: string; bg: string }> = {
  overdue: { icon: '🔴', color: '#EF4444', label: 'Retention dropped — review now', bg: '#EF444410' },
  declining: { icon: '⚠️', color: '#F59E0B', label: 'Predicted to decline tomorrow', bg: '#F59E0B10' },
  new_topic: { icon: '🆕', color: '#6366F1', label: 'Fresh material to explore', bg: '#6366F110' },
  reinforcement: { icon: '✅', color: '#10B981', label: 'Strengthen your memory', bg: '#10B98110' },
};

// ─── Session Row ─────────────────────────────────────────────

function SessionRow({
  session,
  index,
  sessionProgress,
  onPress,
}: {
  session: PlannedStudySession;
  index: number;
  sessionProgress?: SessionProgress;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const cfg = REASON_CONFIG[session.reason];

  // Progress-aware derived values
  const isComplete = sessionProgress?.isComplete ?? false;
  const hasProgress = (sessionProgress?.answered ?? 0) > 0;
  const progressRatio = sessionProgress
    ? Math.min(1, sessionProgress.answered / Math.max(1, sessionProgress.total))
    : 0;

  const translateX = useSharedValue(30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = 200 + index * 100;
    translateX.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const rowBg   = isComplete ? '#10B98108' : cfg.bg;
  const rowBdr  = isComplete ? '#10B98130' : cfg.color + '15';
  const iconBg  = isComplete ? '#10B98118' : cfg.color + '18';
  const barColor = isComplete ? '#10B981'  : cfg.color;
  const labelColor = isComplete ? '#10B981' : hasProgress ? cfg.color : cfg.color;
  const labelText  = isComplete
    ? '✓ Completed today'
    : hasProgress
    ? `In progress — tap to continue`
    : cfg.label;

  // ML metadata — model badge + difficulty/dropout flags
  const ml          = session.mlMeta;
  const modelBadge  = ml ? (MODEL_BADGE[ml.model] ?? null) : null;
  const diffHigh    = ml && (ml.pDifficult  ?? 0) >= 0.6;
  const dropoutHigh = ml && (ml.dropoutRisk ?? 0) >= 0.55;

  return (
    <Animated.View style={animStyle} accessible accessibilityRole="button" accessibilityLabel={`Study ${session.topicName}`}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityLabel={`Study ${session.topicName}, ${session.cardCount} cards, ${session.estimatedMinutes} minutes`}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: rowBg,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: rowBdr,
        }}
      >
        {/* Priority indicator */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography style={{ fontSize: 18 }}>{isComplete ? '✅' : cfg.icon}</Typography>
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="label" numberOfLines={1}>
            {session.topicName}
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
              {session.subjectName}
            </Typography>
            <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
            <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
              {hasProgress
                ? `${sessionProgress!.answered}/${session.cardCount} cards`
                : `${session.cardCount} cards`}
            </Typography>
            <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
            <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
              ~{session.estimatedMinutes}m
            </Typography>
          </View>

          {/* Progress bar — only visible once the session has been opened */}
          {hasProgress && (
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: barColor + '22',
                marginTop: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.round(progressRatio * 100)}%`,
                  backgroundColor: barColor,
                  borderRadius: 2,
                }}
              />
            </View>
          )}

          <Typography variant="caption" color={labelColor} style={{ fontSize: 10, marginTop: 1 }}>
            {labelText}
          </Typography>

          {/* ML badges — difficulty/dropout chips, hidden when complete */}
          {ml && !isComplete && (diffHigh || dropoutHigh) && (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
              {diffHigh && (
                <View style={{
                  backgroundColor: '#F9731615',
                  borderRadius: radius.full,
                  paddingHorizontal: 5, paddingVertical: 1,
                  borderWidth: 1, borderColor: '#F9731630',
                }}>
                  <Typography variant="caption" color="#F97316" style={{ fontSize: 9, lineHeight: 13 }}>
                    ⚡ Challenging
                  </Typography>
                </View>
              )}
              {dropoutHigh && (
                <View style={{
                  backgroundColor: '#F59E0B15',
                  borderRadius: radius.full,
                  paddingHorizontal: 5, paddingVertical: 1,
                  borderWidth: 1, borderColor: '#F59E0B30',
                }}>
                  <Typography variant="caption" color="#F59E0B" style={{ fontSize: 9, lineHeight: 13 }}>
                    💡 Short session
                  </Typography>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Arrow — hidden when complete */}
        {!isComplete && (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.full,
              backgroundColor: cfg.color + '12',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={hasProgress ? 'play' : 'chevron-forward'} size={14} color={cfg.color} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}


// ─── Main Component ──────────────────────────────────────────

interface TodaysStudyPlanProps {
  plan: DailyStudyPlan;
  chronotypePeakHour?: number;
}

export function TodaysStudyPlan({ plan, chronotypePeakHour }: TodaysStudyPlanProps) {
  const { theme } = useTheme();
  const router = useRouter();

  // Per-session progress from AsyncStorage — reflects mid-session breaks immediately
  const { progress } = useDailyPlanProgress();

  const isEmpty = plan.sessions.length === 0;

  // Format optimal window
  const optimalText = chronotypePeakHour != null
    ? `${formatHour(chronotypePeakHour)}–${formatHour((chronotypePeakHour + 3) % 24)}`
    : null;

  // Calculate total cards
  const totalCards = plan.sessions.reduce((sum, s) => sum + s.cardCount, 0);

  if (isEmpty) {
    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        <LinearGradient
          colors={['#10B98120', '#10B98108']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius['2xl'],
            borderWidth: 1,
            borderColor: '#10B98125',
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#10B98118',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </View>
          <Typography variant="label" color="#10B981" align="center">
            You're all caught up! 🎉
          </Typography>
          <Typography variant="caption" color={theme.textTertiary} align="center" style={{ lineHeight: 18 }}>
            No cards are overdue. Keep studying to build your learning profile.
          </Typography>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
        }}
      >
        {/* Header gradient */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background glyph */}
          <Typography
            style={{
              position: 'absolute',
              right: -10,
              top: -20,
              fontSize: 100,
              opacity: 0.08,
            }}
          >
            📋
          </Typography>

          {/* Top label */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="compass" size={12} color="rgba(255,255,255,0.95)" />
            </View>
            <Typography
              variant="captionBold"
              color="rgba(255,255,255,0.9)"
              style={{ letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 10 }}
            >
              Today's Focus
            </Typography>
          </View>

          {/* Insight text */}
          <Typography variant="body" color="#FFFFFF" style={{ lineHeight: 22, maxWidth: '90%', marginBottom: spacing.md }}>
            {plan.insight}
          </Typography>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing.xl }}>
            <View>
              <Typography variant="h3" color="#FFFFFF" style={{ fontSize: 22 }}>
                {plan.sessions.length}
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.6)" style={{ fontSize: 10 }}>
                Topics
              </Typography>
            </View>
            <View>
              <Typography variant="h3" color="#FFFFFF" style={{ fontSize: 22 }}>
                {totalCards}
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.6)" style={{ fontSize: 10 }}>
                Cards
              </Typography>
            </View>
            <View>
              <Typography variant="h3" color="#FFFFFF" style={{ fontSize: 22 }}>
                ~{plan.totalMinutes}m
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.6)" style={{ fontSize: 10 }}>
                Est. time
              </Typography>
            </View>
            {optimalText && (
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Typography variant="caption" color="rgba(255,255,255,0.9)" style={{ fontSize: 10 }}>
                    ⏰ {optimalText}
                  </Typography>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Session list */}
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          {plan.sessions.map((session, i) => (
            <SessionRow
              key={session.topicSlug}
              session={session}
              index={i}
              sessionProgress={progress[session.topicSlug]}
              onPress={() => {
                // Encode mlMeta as string params so topic-review can forward them
                // to FocusQualityScore on the completion screen.
                const mlParams = session.mlMeta ? {
                  mlPDifficult:  String((session.mlMeta.pDifficult  ?? 0).toFixed(3)),
                  mlDropoutRisk: String((session.mlMeta.dropoutRisk ?? 0).toFixed(3)),
                  mlModel:       session.mlMeta.model,
                } : {};

                router.push({
                  pathname: '/topic-review',
                  params: {
                    topicSlug:   session.topicSlug,
                    topicName:   session.topicName,
                    subjectName: session.subjectName,
                    subjectId:   session.subjectId,
                    examId:      session.examId ?? '',
                    // Always use daily_plan so fetchLevelCards is called and the
                    // full suggestedCount (cardCount) is honoured.
                    mode:        'daily_plan',
                    cardCount:   String(session.cardCount),
                    level:       DIFFICULTY_TO_LEVEL[session.difficulty] ?? 'Emerging',
                    ...mlParams,
                  },
                });
              }}
            />
          ))}
        </View>

        {/* Start Studying CTA */}
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              // Launch the first session's topic directly, carrying level + mlMeta params
              const first = plan.sessions[0];
              if (first) {
                const mlParams = first.mlMeta ? {
                  mlPDifficult:  String((first.mlMeta.pDifficult  ?? 0).toFixed(3)),
                  mlDropoutRisk: String((first.mlMeta.dropoutRisk ?? 0).toFixed(3)),
                  mlModel:       first.mlMeta.model,
                } : {};
                router.push({
                  pathname: '/topic-review',
                  params: {
                    topicSlug:   first.topicSlug,
                    topicName:   first.topicName,
                    subjectName: first.subjectName,
                    subjectId:   first.subjectId,
                    examId:      first.examId ?? '',
                    mode:        'daily_plan',
                    cardCount:   String(first.cardCount),
                    level:       DIFFICULTY_TO_LEVEL[first.difficulty] ?? 'Emerging',
                    ...mlParams,
                  },
                });
              }
            }}
            accessibilityLabel="Start today's study plan"
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: '#6366F1',
              borderRadius: radius.xl,
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name="play-circle" size={18} color="#FFFFFF" />
            <Typography variant="label" color="#FFFFFF">
              Start Today's Plan
            </Typography>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}
