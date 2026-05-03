// ─── ExamReadinessScore ──────────────────────────────────────
// Prominent readiness score with animated ring, mastery level label,
// strong/weak areas breakdown, and forecasting text.

import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import type { ExamReadiness } from '@kd/shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Mastery Level Labels ────────────────────────────────────

function getMasteryLabel(score: number): { label: string; sublabel: string; color: string } {
  if (score >= 85) return { label: 'Master', sublabel: 'You own this material', color: '#6366F1' };
  if (score >= 60) return { label: 'Proficient', sublabel: 'Solid foundation built', color: '#10B981' };
  if (score >= 40) return { label: 'Developing', sublabel: 'Building understanding', color: '#F59E0B' };
  return { label: 'Emerging', sublabel: 'Your journey is starting', color: '#F97316' };
}

// ─── Animated Ring ───────────────────────────────────────────

function ReadinessRing({ score }: { score: number }) {
  const { theme } = useTheme();
  const size = 140;
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(score / 100, 1), {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const mastery = getMasteryLabel(score);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={mastery.color} stopOpacity="1" />
            <Stop offset="1" stopColor={mastery.color} stopOpacity="0.6" />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.border + '30'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center content */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
        }}
      >
        <Typography variant="h2" color={mastery.color} style={{ fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
          {score}
        </Typography>
        <View
          style={{
            backgroundColor: mastery.color + '15',
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            marginTop: -2,
          }}
        >
          <Typography variant="captionBold" color={mastery.color} style={{ fontSize: 9, letterSpacing: 0.5 }}>
            {mastery.label.toUpperCase()}
          </Typography>
        </View>
      </View>
    </View>
  );
}

// ─── Area Chips ──────────────────────────────────────────────

function AreaChips({
  areas,
  color,
  icon,
  label,
}: {
  areas: string[];
  color: string;
  icon: string;
  label: string;
}) {
  const { theme } = useTheme();
  if (areas.length === 0) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Typography style={{ fontSize: 12 }}>{icon}</Typography>
        <Typography variant="captionBold" color={theme.textTertiary} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {areas.map((area) => (
          <View
            key={area}
            style={{
              backgroundColor: color + '10',
              borderRadius: radius.full,
              paddingHorizontal: spacing.md,
              paddingVertical: 5,
              borderWidth: 1,
              borderColor: color + '20',
            }}
          >
            <Typography variant="caption" color={color} style={{ fontSize: 11 }}>
              {area}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface ExamReadinessScoreProps {
  data: ExamReadiness;
}

export function ExamReadinessScore({ data }: ExamReadinessScoreProps) {
  const { theme } = useTheme();

  if (data.overallScore === 0 && data.strongAreas.length === 0) {
    return null; // Don't show if no data at all
  }

  const mastery = getMasteryLabel(data.overallScore);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <Card>
        <View style={{ gap: spacing.lg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.lg,
                  backgroundColor: mastery.color + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography style={{ fontSize: 14 }}>🎯</Typography>
              </View>
              <View>
                <Typography variant="label">Exam Readiness</Typography>
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                  {mastery.sublabel}
                </Typography>
              </View>
            </View>
            {data.weeklyDelta !== 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: (data.weeklyDelta > 0 ? '#10B981' : '#EF4444') + '15',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                }}
              >
                <Typography
                  variant="captionBold"
                  color={data.weeklyDelta > 0 ? '#10B981' : '#EF4444'}
                  style={{ fontSize: 11 }}
                >
                  {data.weeklyDelta > 0 ? '↑' : '↓'} {Math.abs(data.weeklyDelta)}%
                </Typography>
              </View>
            )}
          </View>

          {/* Ring */}
          <View style={{ alignItems: 'center' }}>
            <ReadinessRing score={data.overallScore} />
          </View>

          {/* Strong / Vulnerable areas */}
          <View style={{ gap: spacing.md }}>
            <AreaChips
              areas={data.strongAreas}
              color="#10B981"
              icon="💪"
              label="Exam-ready"
            />
            <AreaChips
              areas={data.vulnerableAreas}
              color="#EF4444"
              icon="📖"
              label="Needs more practice"
            />
          </View>

          {/* Forecast text */}
          {data.daysToTargetReadiness > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: '#6366F108',
                borderRadius: radius.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: '#6366F115',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#6366F115',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography style={{ fontSize: 12 }}>📈</Typography>
              </View>
              <Typography variant="bodySmall" color={theme.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
                At your current pace, you'll reach{' '}
                <Typography variant="captionBold" color="#6366F1">Master level</Typography>
                {' '}in ~{data.daysToTargetReadiness} study days
              </Typography>
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}
