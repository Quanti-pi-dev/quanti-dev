// ─── TargetSubjectCard ───────────────────────────────────────
// Premium animated card for the "Your Target Subjects" carousel.
// Features: accent gradient blob, circular mastery ring,
// level badge chip, scale-on-press haptic, staggered entrance.

import { useEffect, memo } from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { getMasteryDisplayInfo } from '../utils/mastery';

// ─── Accent palette ───────────────────────────────────────────
export const SUBJECT_ACCENT_PALETTE = [
  { bg: '#6366F1', muted: 'rgba(99,102,241,0.15)',  grad: ['#6366F1', '#818CF8'] as [string, string] },
  { bg: '#10B981', muted: 'rgba(16,185,129,0.15)',  grad: ['#10B981', '#34D399'] as [string, string] },
  { bg: '#F59E0B', muted: 'rgba(245,158,11,0.15)',  grad: ['#F59E0B', '#FCD34D'] as [string, string] },
  { bg: '#EF4444', muted: 'rgba(239,68,68,0.15)',   grad: ['#EF4444', '#F87171'] as [string, string] },
  { bg: '#8B5CF6', muted: 'rgba(139,92,246,0.15)',  grad: ['#8B5CF6', '#A78BFA'] as [string, string] },
  { bg: '#06B6D4', muted: 'rgba(6,182,212,0.15)',   grad: ['#06B6D4', '#22D3EE'] as [string, string] },
  { bg: '#F97316', muted: 'rgba(249,115,22,0.15)',  grad: ['#F97316', '#FB923C'] as [string, string] },
  { bg: '#EC4899', muted: 'rgba(236,72,153,0.15)',  grad: ['#EC4899', '#F472B6'] as [string, string] },
];

// ─── Icon mapping ─────────────────────────────────────────────
// Centralized in constants/subject-icons.ts — re-exported here
// so existing callers don't need to change their import paths.
import { resolveSubjectIcon, type IoniconName } from '../constants/subject-icons';

export function getSubjectIcon(name: string): IoniconName {
  return resolveSubjectIcon(name);
}


// ─── SVG Progress Ring ────────────────────────────────────────
interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}

function ProgressRing({ progress, size, strokeWidth, color, trackColor }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

// ─── Main Card ────────────────────────────────────────────────

export interface TargetSubjectCardProps {
  subject: { id: string; name: string; description?: string; iconName?: string };
  accentIndex: number;
  /** Total correct answers across all levels for this subject */
  correctAnswers?: number;
  /** Highest level index reached (0=Emerging … 3=Master) */
  levelIndex?: number;
  animDelay?: number;
  onPress: () => void;
  style?: ViewStyle;
}

export const TargetSubjectCard = memo(function TargetSubjectCard({
  subject,
  accentIndex,
  correctAnswers = 0,
  levelIndex = 0,
  animDelay = 0,
  onPress,
  style,
}: TargetSubjectCardProps) {
  const { theme } = useTheme();
  const accent = SUBJECT_ACCENT_PALETTE[accentIndex % SUBJECT_ACCENT_PALETTE.length]!;
  const icon = (subject.iconName as IoniconName) || getSubjectIcon(subject.name);
  const mastery = getMasteryDisplayInfo(correctAnswers, levelIndex);

  // ── Entrance animation ──────────────────────────────────────
  const translateY = useSharedValue(28);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(animDelay, withSpring(0, { stiffness: 130, damping: 18 }));
    opacity.value    = withDelay(animDelay, withTiming(1, { duration: 350 }));
  }, [animDelay]);

  // ── Press scale ─────────────────────────────────────────────
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    pressScale.value = withTiming(0.96, { duration: 100, easing: Easing.out(Easing.quad) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { stiffness: 300, damping: 20 });
  };

  return (
    <Animated.View style={[entryStyle, style]}>
      <Animated.View style={pressStyle}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={`${subject.name}. Mastery: ${mastery.label}, ${mastery.pct}%`}
          accessibilityHint="Double tap to start studying this subject"
          style={{
            width: 176,
            backgroundColor: theme.card,
            borderRadius: radius['2xl'],
            borderWidth: 1.5,
            borderColor: accent.bg + '44',
            overflow: 'hidden',
          }}
        >
          {/* Gradient top strip */}
          <LinearGradient
            colors={[accent.bg + '28', accent.bg + '08']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}
          >
            {/* Icon + level badge row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 46, height: 46,
                  borderRadius: radius.full,
                  backgroundColor: accent.muted,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name={icon} size={22} color={accent.bg} />
              </View>

              {/* Educator mastery badge */}
              <View
                style={{
                  backgroundColor: mastery.educator.color + '18',
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: mastery.educator.color + '40',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Typography style={{ fontSize: 9 }}>{mastery.educator.emoji}</Typography>
                <Typography
                  variant="captionBold"
                  color={mastery.educator.color}
                  style={{ fontSize: 9, letterSpacing: 0.3 }}
                >
                  {mastery.educator.label}
                </Typography>
              </View>
            </View>

            {/* Subject name */}
            <Typography variant="label" numberOfLines={2} style={{ lineHeight: 18, marginTop: spacing.xs }}>
              {subject.name}
            </Typography>
          </LinearGradient>

          {/* Bottom: progress ring + label */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderTopWidth: 1,
              borderTopColor: accent.bg + '18',
            }}
          >
            <View style={{ width: 44, height: 44 }}>
              <ProgressRing
                progress={mastery.progress}
                size={44}
                strokeWidth={4.5}
                color={accent.bg}
                trackColor={accent.bg + '22'}
              />
              <View
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  color={accent.bg}
                  style={{ fontSize: 9, fontWeight: '700' }}
                >
                  {mastery.pct}%
                </Typography>
              </View>
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Typography variant="captionBold" color={mastery.educator.color} style={{ fontSize: 10 }}>
                {mastery.educator.sublabel}
              </Typography>
              {/* Mini progress bar */}
              <View
                style={{
                  height: 3, borderRadius: 2,
                  backgroundColor: accent.bg + '22',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${mastery.pct}%`,
                    backgroundColor: accent.bg,
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});
