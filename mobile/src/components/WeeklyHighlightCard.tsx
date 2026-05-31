// ─── Weekly Highlight Reel Card ───────────────────────────────
// Shows the user's personalized "best of the week" summary.
// Designed to be slotted into the Home dashboard.
//
// Psychology: Investment + Variable Reward.
//   Users become emotionally attached to their highlight stories —
//   each week's reel is a narrative about growth that reinforces
//   the identity of being a "serious student."

import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { Skeleton } from './ui/Skeleton';
import { fetchLatestHighlight, type WeeklyHighlight } from '../services/behavioral-contracts';

// ─── Stat pill inside the card ────────────────────────────────

function StatPill({
  icon,
  value,
  label,
  color,
  delay,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    scale.value = withDelay(delay, withSpring(1, { stiffness: 180, damping: 16 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          flex: 1,
          alignItems: 'center',
          gap: 2,
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderRadius: radius.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.xs,
        },
      ]}
    >
      <Ionicons name={icon as never} size={16} color={color} />
      <Typography variant="captionBold" color="#FFFFFF" style={{ fontSize: 15 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="rgba(255,255,255,0.65)" style={{ fontSize: 10 }}>
        {label}
      </Typography>
    </Animated.View>
  );
}

// ─── Gradient accent bar ──────────────────────────────────────

function PulseBar() {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      300,
      withSequence(
        withTiming(100, { duration: 900 }),
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` as unknown as number }));

  return (
    <View
      style={{
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          style,
          { height: '100%', backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 2 },
        ]}
      />
    </View>
  );
}

// ─── Main Card ────────────────────────────────────────────────

function HighlightCard({ highlight }: { highlight: WeeklyHighlight }) {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 160, damping: 18 });
    opacity.value = withTiming(1, { duration: 350 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const formatMinutes = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <Animated.View style={[style, { borderRadius: radius['2xl'], overflow: 'hidden' }]}>
      <LinearGradient
        colors={['#1D4ED8', '#3B82F6', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.lg, gap: spacing.md }}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="film-outline" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="overline" color="rgba(255,255,255,0.7)">
              WEEKLY REEL · {highlight.weekLabel}
            </Typography>
            <Typography variant="h4" color="#FFFFFF" style={{ fontWeight: '700' }}>
              {highlight.headline}
            </Typography>
          </View>
        </View>

        <PulseBar />

        {/* Stat pills grid */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <StatPill
            icon="library-outline"
            value={String(highlight.cardsStudied)}
            label="Cards"
            color="#A5F3FC"
            delay={100}
          />
          <StatPill
            icon="checkmark-circle-outline"
            value={`${highlight.accuracy}%`}
            label="Accuracy"
            color="#6EE7B7"
            delay={180}
          />
          <StatPill
            icon="time-outline"
            value={formatMinutes(highlight.minutesStudied)}
            label="Study Time"
            color="#FDE68A"
            delay={260}
          />
          <StatPill
            icon="logo-bitcoin"
            value={`+${highlight.coinsEarned}`}
            label="Coins"
            color="#FCD34D"
            delay={340}
          />
        </View>

        {/* Top subject badge */}
        {highlight.topSubject && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: radius.full,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              alignSelf: 'flex-start',
            }}
          >
            <Ionicons name="star-outline" size={12} color="#FDE68A" />
            <Typography variant="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>
              Top Subject: {highlight.topSubject}
            </Typography>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Exported Hook + Component ────────────────────────────────

export function useWeeklyHighlight() {
  return useQuery({
    queryKey: ['weekly-highlight'],
    queryFn: fetchLatestHighlight,
    staleTime: 60 * 60 * 1000,     // 1 hour — highlights don't change often
    gcTime: 2 * 60 * 60 * 1000,
  });
}

export function WeeklyHighlightCard({ onDismiss }: { onDismiss?: () => void }) {
  const { theme } = useTheme();
  const { data: highlight, isLoading } = useWeeklyHighlight();

  if (isLoading) {
    return <Skeleton width="100%" height={200} borderRadius={radius['2xl']} />;
  }

  if (!highlight) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      {/* Dismiss link */}
      {onDismiss && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">This Week's Reel</Typography>
          <TouchableOpacity
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss weekly highlight"
          >
            <Ionicons name="close" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      )}
      <HighlightCard highlight={highlight} />
    </View>
  );
}
