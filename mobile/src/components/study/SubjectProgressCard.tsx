// ─── SubjectProgressCard ─────────────────────────────────────
// Compact horizontal-carousel card that shows a subject the user
// has already started studying, including their current level and
// a circular mastery ring.

import { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { radius, spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { getSubjectIcon, SUBJECT_ACCENT_PALETTE } from '../TargetSubjectCard';

// ─── Level labels ─────────────────────────────────────────────
const LEVEL_LABELS = ['Beginner', 'Elementary', 'Developing', 'Proficient', 'Advanced', 'Master'];

function ProgressRing({
  progress,
  size,
  strokeWidth,
  color,
  trackColor,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(progress, 1));

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

// ─── Props ────────────────────────────────────────────────────

export interface SubjectProgressCardProps {
  /** Subject name e.g. "Quantitative Aptitude" */
  subjectName: string;
  /** Exam name e.g. "CAT 2025" */
  examName?: string;
  /** 0-5 index (0=Beginner … 5=Master) */
  levelIndex: number;
  /** Correct answers used to derive mastery 0–1 ring fill */
  correctAnswers: number;
  /** Index in the palette for accent color */
  accentIndex: number;
  /** Navigation callback */
  onPress: () => void;
  /** Stagger delay for entrance anim */
  animDelay?: number;
}

// ─── Component ────────────────────────────────────────────────

export function SubjectProgressCard({
  subjectName,
  examName,
  levelIndex,
  correctAnswers: _correctAnswers,
  accentIndex,
  onPress,
  animDelay = 0,
}: SubjectProgressCardProps) {
  const { theme } = useTheme();
  const accent = SUBJECT_ACCENT_PALETTE[accentIndex % SUBJECT_ACCENT_PALETTE.length]!;
  const icon = getSubjectIcon(subjectName);

  // Mastery ring 0-1 based on level (6 levels total)
  const masteryProgress = Math.min((levelIndex + 1) / 6, 1);
  const levelLabel = LEVEL_LABELS[levelIndex] ?? 'Beginner';

  // ── Entrance animation ────────────────────────────────────
  const translateX = useSharedValue(30);
  const opacity = useSharedValue(0);
  useEffect(() => {
    translateX.value = withDelay(animDelay, withSpring(0, { stiffness: 130, damping: 18 }));
    opacity.value = withDelay(animDelay, withTiming(1, { duration: 350 }));
  }, [animDelay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${subjectName} — ${levelLabel}. Tap to continue studying.`}
        style={{
          width: 172,
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          borderWidth: 1.5,
          borderColor: accent.bg + '44',
          overflow: 'hidden',
          shadowColor: accent.bg,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        {/* Gradient header */}
        <LinearGradient
          colors={[accent.bg + '28', accent.bg + '08']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing.md, gap: spacing.xs }}
        >
          {/* Icon row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: radius.full,
                backgroundColor: accent.muted,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name={icon} size={20} color={accent.bg} />
            </View>
            {/* Level badge */}
            <View
              style={{
                backgroundColor: accent.bg + '22',
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: accent.bg + '55',
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Typography
                variant="captionBold"
                color={accent.bg}
                style={{ fontSize: 9, letterSpacing: 0.5 }}
              >
                L{levelIndex + 1}
              </Typography>
            </View>
          </View>

          {/* Subject name */}
          <Typography variant="label" numberOfLines={2} style={{ lineHeight: 17, marginTop: spacing.xs }}>
            {subjectName}
          </Typography>

          {examName && (
            <Typography variant="caption" color={accent.bg + 'BB'} numberOfLines={1}>
              {examName}
            </Typography>
          )}
        </LinearGradient>

        {/* Footer: ring + level label */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            borderTopWidth: 1,
            borderTopColor: accent.bg + '18',
          }}
        >
          {/* Ring */}
          <View style={{ width: 38, height: 38 }}>
            <ProgressRing
              progress={masteryProgress}
              size={38}
              strokeWidth={3.5}
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
                style={{ fontSize: 8, fontWeight: '700' }}
              >
                {Math.round(masteryProgress * 100)}%
              </Typography>
            </View>
          </View>

          {/* Label + mini bar */}
          <View style={{ flex: 1, gap: 3 }}>
            <Typography variant="captionBold" color={theme.text} style={{ fontSize: 10 }}>
              {levelLabel}
            </Typography>
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
                  width: `${Math.round(masteryProgress * 100)}%`,
                  backgroundColor: accent.bg,
                  borderRadius: 2,
                }}
              />
            </View>
          </View>

          <Ionicons name="chevron-forward" size={13} color={accent.bg + 'BB'} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
