// ─── ExamReadinessGauge ──────────────────────────────────────
// Compact exam readiness widget for the Home screen.
// Shows the overall score, weekly delta, and the 5-signal breakdown
// as mini progress bars. Tapping navigates to the Progress tab.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { ProgressBar } from './ui/ProgressBar';
import type { ExamReadiness } from '@kd/shared';

interface Props {
  data: ExamReadiness;
}

function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
          {label}
        </Typography>
        <Typography variant="caption" color={color} style={{ fontSize: 10 }}>
          {value}%
        </Typography>
      </View>
      <ProgressBar progress={value / 100} height={3} color={color} />
    </View>
  );
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  if (score >= 30) return '#F97316';
  return '#EF4444';
}

export function ExamReadinessGauge({ data }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const scoreColor = getScoreColor(data.overallScore);

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(350)}>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/progress')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Exam readiness ${data.overallScore} percent`}
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: theme.border,
          gap: spacing.md,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              width: 28, height: 28, borderRadius: radius.lg,
              backgroundColor: scoreColor + '15',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography style={{ fontSize: 14 }}>🎯</Typography>
            </View>
            <View>
              <Typography variant="label">Exam Readiness</Typography>
              {data.daysToTargetReadiness > 0 && data.overallScore < 85 && (
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                  ~{data.daysToTargetReadiness}d to 85% target
                </Typography>
              )}
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <Typography variant="h3" color={scoreColor} style={{ fontSize: 28, fontWeight: '700' }}>
                {data.overallScore}
              </Typography>
              <Typography variant="caption" color={scoreColor} style={{ fontSize: 12 }}>%</Typography>
            </View>
            {data.weeklyDelta !== 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 2,
                backgroundColor: (data.weeklyDelta > 0 ? '#10B981' : '#EF4444') + '12',
                borderRadius: radius.full,
                paddingHorizontal: 5, paddingVertical: 1,
              }}>
                <Ionicons
                  name={data.weeklyDelta > 0 ? 'trending-up' : 'trending-down'}
                  size={10}
                  color={data.weeklyDelta > 0 ? '#10B981' : '#EF4444'}
                />
                <Typography
                  variant="caption"
                  color={data.weeklyDelta > 0 ? '#10B981' : '#EF4444'}
                  style={{ fontSize: 10 }}
                >
                  {data.weeklyDelta > 0 ? '+' : ''}{data.weeklyDelta}%
                </Typography>
              </View>
            )}
          </View>
        </View>

        {/* 5-signal breakdown */}
        <View style={{ gap: spacing.xs }}>
          <SignalBar
            label="Concept Mastery"
            value={data.conceptMasteryScore}
            color={getScoreColor(data.conceptMasteryScore)}
          />
          <SignalBar
            label="Depth"
            value={data.depthScore}
            color={getScoreColor(data.depthScore)}
          />
          <SignalBar
            label="Coverage"
            value={Math.round(data.coverageFactor * 100)}
            color={getScoreColor(Math.round(data.coverageFactor * 100))}
          />
          <SignalBar
            label="Consistency"
            value={data.consistencyScore}
            color={getScoreColor(data.consistencyScore)}
          />
          <SignalBar
            label="Ability Match"
            value={data.abilityScore}
            color={getScoreColor(data.abilityScore)}
          />
        </View>

        {/* Strong / vulnerable chips */}
        {(data.strongAreas.length > 0 || data.vulnerableAreas.length > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {data.strongAreas.slice(0, 2).map((area) => (
              <View key={area} style={{
                backgroundColor: '#10B98112', borderRadius: radius.full,
                paddingHorizontal: 8, paddingVertical: 3,
              }}>
                <Typography variant="caption" color="#10B981" style={{ fontSize: 10 }}>
                  ✓ {area}
                </Typography>
              </View>
            ))}
            {data.vulnerableAreas.slice(0, 2).map((area) => (
              <View key={area} style={{
                backgroundColor: '#EF444412', borderRadius: radius.full,
                paddingHorizontal: 8, paddingVertical: 3,
              }}>
                <Typography variant="caption" color="#EF4444" style={{ fontSize: 10 }}>
                  ⚠ {area}
                </Typography>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
