// ─── MemoryForecast ──────────────────────────────────────────
// Shows topics the student will forget within 7 days if they
// don't review. Uses existing TopicForecast data from the
// learning intelligence engine.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import type { TopicForecast } from '@kd/shared';

// ─── Helpers ──────────────────────────────────────────────────

function riskColor(risk: TopicForecast['riskLevel']): string {
  if (risk === 'high') return '#EF4444';
  if (risk === 'medium') return '#F59E0B';
  return '#10B981';
}

function riskIcon(risk: TopicForecast['riskLevel']): string {
  if (risk === 'high') return 'warning';
  if (risk === 'medium') return 'alert-circle';
  return 'checkmark-circle';
}

// ─── Component ────────────────────────────────────────────────

interface MemoryForecastProps {
  forecasts: TopicForecast[];
}

export function MemoryForecast({ forecasts }: MemoryForecastProps) {
  const { theme } = useTheme();
  const router = useRouter();

  // Split into at-risk vs safe
  const atRisk = forecasts.filter(f => f.riskLevel === 'high' || f.riskLevel === 'medium');
  const safe = forecasts.filter(f => f.riskLevel === 'low').slice(0, 3);

  if (forecasts.length === 0) {
    return null; // No forecast data yet
  }

  return (
    <Card>
      <View style={{ gap: spacing.lg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: '#8B5CF618',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography variant="bodyLarge">🔮</Typography>
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h4">Memory Forecast</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Next 7 days</Typography>
          </View>
          {atRisk.length > 0 && (
            <View style={{
              paddingHorizontal: spacing.sm, paddingVertical: 3,
              borderRadius: radius.full,
              backgroundColor: '#EF444412',
            }}>
              <Typography variant="caption" color="#EF4444" style={{ fontSize: 10 }}>
                {atRisk.length} at risk
              </Typography>
            </View>
          )}
        </View>

        {/* At-risk topics */}
        {atRisk.slice(0, 4).map((f, i) => {
          const color = riskColor(f.riskLevel);
          const icon = riskIcon(f.riskLevel);
          const decay = f.currentAccuracy - f.predictedAccuracyIn7Days;
          return (
            <Animated.View
              key={f.topicSlug}
              entering={FadeInDown.delay(i * 60).duration(250)}
              style={{
                backgroundColor: color + '08',
                borderRadius: radius.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: color + '20',
                gap: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name={icon as any} size={18} color={color} />
                <View style={{ flex: 1 }}>
                  <Typography variant="label" numberOfLines={1}>{f.topicName}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>{f.subjectName}</Typography>
                </View>
              </View>

              {/* Retention numbers */}
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="caption" color={theme.textSecondary}>Now</Typography>
                  <Typography variant="label" color={theme.text}>{Math.round(f.currentAccuracy)}%</Typography>
                </View>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-forward" size={14} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="caption" color={theme.textSecondary}>In 7 days</Typography>
                  <Typography variant="label" color={color}>{Math.round(f.predictedAccuracyIn7Days)}%</Typography>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Typography variant="caption" color={theme.textSecondary}>Decay</Typography>
                  <Typography variant="captionBold" color={color}>−{Math.round(decay)}%</Typography>
                </View>
              </View>

              {/* Fix CTA */}
              <TouchableOpacity
                onPress={() => {
                  if (f.examId && f.subjectId) {
                    router.push({
                      pathname: '/exams/[examId]/subjects/[subjectId]/levels',
                      params: {
                        examId: f.examId,
                        subjectId: f.subjectId,
                        title: f.subjectName,
                        topicSlug: f.topicSlug,
                      },
                    });
                  } else {
                    router.push('/(tabs)/study');
                  }
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  backgroundColor: color + '15',
                }}
              >
                <Ionicons name="refresh" size={14} color={color} />
                <Typography variant="captionBold" color={color}>
                  Review {f.recommendedReviewCards} cards
                </Typography>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Safe topics — compact */}
        {safe.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            {safe.map(f => (
              <View
                key={f.topicSlug}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: 4,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Typography variant="caption" color={theme.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
                  {f.topicName}
                </Typography>
                <Typography variant="caption" color="#10B981">
                  Safe
                </Typography>
              </View>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}
