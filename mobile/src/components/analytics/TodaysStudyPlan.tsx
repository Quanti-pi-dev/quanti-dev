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
import type { DailyStudyPlan, PlannedStudySession, StudySessionReason } from '@kd/shared';

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
}: {
  session: PlannedStudySession;
  index: number;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const cfg = REASON_CONFIG[session.reason];

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

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        activeOpacity={0.75}
        accessibilityLabel={`Study ${session.topicName}, ${session.cardCount} cards, ${session.estimatedMinutes} minutes`}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: cfg.bg,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: cfg.color + '15',
        }}
      >
        {/* Priority indicator */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            backgroundColor: cfg.color + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography style={{ fontSize: 18 }}>{cfg.icon}</Typography>
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
              {session.cardCount} cards
            </Typography>
            <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
            <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
              ~{session.estimatedMinutes}m
            </Typography>
          </View>
          <Typography variant="caption" color={cfg.color} style={{ fontSize: 10, marginTop: 1 }}>
            {cfg.label}
          </Typography>
        </View>

        {/* Arrow */}
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
          <Ionicons name="chevron-forward" size={14} color={cfg.color} />
        </View>
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
            <SessionRow key={session.topicSlug} session={session} index={i} />
          ))}
        </View>

        {/* Start Studying CTA */}
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/study')}
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
