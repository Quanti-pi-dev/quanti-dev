// ─── MemoryForecast ──────────────────────────────────────────
// Shows topics the student will forget within 7 days if they
// don't review. Uses TopicForecast data from the learning
// intelligence engine (SM-2 Ebbinghaus decay model).
//
// UI improvements over v1:
//  - Specific recall probability instead of vague "Safe/High Risk"
//  - Decay bar showing current → predicted drop
//  - Human-readable urgency copy: "Forgetting ~8% by Thursday"
//  - "When to review" urgency chip (Today / This week / Later)

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
  if (risk === 'high')   return '#EF4444';
  if (risk === 'medium') return '#F59E0B';
  return '#10B981';
}

function riskIcon(risk: TopicForecast['riskLevel']): string {
  if (risk === 'high')   return 'warning';
  if (risk === 'medium') return 'alert-circle';
  return 'checkmark-circle';
}

/**
 * Maps predicted recall % → when the student should review.
 * High risk topics should be reviewed today; medium this week.
 */
function urgencyChip(risk: TopicForecast['riskLevel'], decay: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (risk === 'high' || decay >= 20) {
    return { label: 'Review today', color: '#EF4444', bg: '#EF444412' };
  }
  if (risk === 'medium' || decay >= 8) {
    return { label: 'This week', color: '#F59E0B', bg: '#F59E0B12' };
  }
  return { label: 'On track', color: '#10B981', bg: '#10B98112' };
}

/**
 * Human-readable decay copy.
 * "Forgetting ~8% by Thursday" feels much more concrete than "Medium risk".
 */
function decayCopy(decay: number, predicted: number): string {
  if (decay <= 0) return `Holding at ${Math.round(predicted)}%`;
  if (decay < 5)  return `Slight drift — −${Math.round(decay)}% if skipped`;
  return `Forgetting ~${Math.round(decay)}% without review`;
}

// ─── DecayBar ─────────────────────────────────────────────────

function DecayBar({
  current,
  predicted,
  color,
}: {
  current: number;
  predicted: number;
  color: string;
}) {
  const { theme } = useTheme();
  const currentPct  = Math.max(0, Math.min(100, current));
  const predictedPct = Math.max(0, Math.min(100, predicted));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Now
          </Typography>
          <Typography variant="captionBold" color={theme.text} style={{ fontSize: 12 }}>
            {Math.round(currentPct)}%
          </Typography>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            In 7 days
          </Typography>
          <Typography variant="captionBold" color={color} style={{ fontSize: 12 }}>
            {Math.round(predictedPct)}%
          </Typography>
        </View>
      </View>

      {/* Bar: grey track, current in neutral, predicted drop shown in risk color */}
      <View style={{ height: 6, backgroundColor: theme.border, borderRadius: radius.full, overflow: 'hidden' }}>
        {/* Full current retention */}
        <View
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${currentPct}%`,
            backgroundColor: theme.textTertiary + '40',
            borderRadius: radius.full,
          }}
        />
        {/* Predicted retention — solid colour */}
        <View
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${predictedPct}%`,
            backgroundColor: color + 'CC',
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────

interface MemoryForecastProps {
  forecasts: TopicForecast[];
}

export function MemoryForecast({ forecasts }: MemoryForecastProps) {
  const { theme } = useTheme();
  const router = useRouter();

  // Split: at-risk first, then safe (compact)
  const atRisk = forecasts.filter((f) => f.riskLevel === 'high' || f.riskLevel === 'medium');
  const safe   = forecasts.filter((f) => f.riskLevel === 'low').slice(0, 3);

  if (forecasts.length === 0) return null;

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
            <Typography variant="caption" color={theme.textTertiary}>
              Predicted recall in 7 days
            </Typography>
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

        {/* At-risk topic cards */}
        {atRisk.slice(0, 4).map((f, i) => {
          const color  = riskColor(f.riskLevel);
          const icon   = riskIcon(f.riskLevel);
          const decay  = f.currentAccuracy - f.predictedAccuracyIn7Days;
          const chip   = urgencyChip(f.riskLevel, decay);
          const copy   = decayCopy(decay, f.predictedAccuracyIn7Days);

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
                gap: spacing.md,
              }}
            >
              {/* Title + urgency chip */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <Ionicons name={icon as any} size={17} color={color} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Typography variant="label" numberOfLines={1}>{f.topicName}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>{f.subjectName}</Typography>
                </View>
                {/* Urgency chip */}
                <View style={{
                  paddingHorizontal: 7, paddingVertical: 3,
                  borderRadius: radius.full,
                  backgroundColor: chip.bg,
                  borderWidth: 1, borderColor: chip.color + '25',
                }}>
                  <Typography variant="caption" color={chip.color} style={{ fontSize: 10, fontWeight: '700' }}>
                    {chip.label}
                  </Typography>
                </View>
              </View>

              {/* Decay bar */}
              <DecayBar
                current={f.currentAccuracy}
                predicted={f.predictedAccuracyIn7Days}
                color={color}
              />

              {/* Human copy */}
              <Typography variant="caption" color={color + 'CC'} style={{ fontSize: 11 }}>
                📉 {copy}
              </Typography>

              {/* CTA */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/topic-review',
                    params: {
                      topicSlug:  f.topicSlug,
                      topicName:  f.topicName,
                      subjectName: f.subjectName,
                      subjectId:  f.subjectId ?? '',
                      examId:     f.examId ?? '',
                      mode:       'memory_review',
                      cardCount:  String(f.recommendedReviewCards),
                    },
                  })
                }
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
                  Review {f.recommendedReviewCards} cards now
                </Typography>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Safe topics — compact with specific recall % */}
        {safe.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              ✅ Stable
            </Typography>
            {safe.map((f) => (
              <View
                key={f.topicSlug}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: 5,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Typography
                  variant="caption"
                  color={theme.textSecondary}
                  style={{ flex: 1 }}
                  numberOfLines={1}
                >
                  {f.topicName}
                </Typography>
                {/* Specific predicted recall — much more informative than "Safe" */}
                <Typography variant="captionBold" color="#10B981" style={{ fontSize: 10 }}>
                  ~{Math.round(f.predictedAccuracyIn7Days)}% recall
                </Typography>
              </View>
            ))}
          </View>
        )}

      </View>
    </Card>
  );
}
