// ─── TopicDecayAlert ─────────────────────────────────────────
// High-urgency alert card shown on the Home screen when topics
// are predicted to significantly decline within the next 7 days.
// Only renders when at least one topic has riskLevel === 'high'.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import type { TopicForecast } from '@kd/shared';

interface Props {
  forecasts: TopicForecast[];
}

export function TopicDecayAlert({ forecasts }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const highRisk = forecasts.filter(f => f.riskLevel === 'high');
  if (highRisk.length === 0) return null;

  // Show top 3 most at-risk topics
  const display = highRisk
    .sort((a, b) => (a.predictedAccuracyIn7Days - a.currentAccuracy) - (b.predictedAccuracyIn7Days - b.currentAccuracy))
    .slice(0, 3);

  const totalReviewCards = display.reduce((sum, t) => sum + t.recommendedReviewCards, 0);

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(350)}>
      <View style={{
        backgroundColor: '#EF444408',
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: '#EF444425',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        }}>
          <View style={{
            width: 28, height: 28, borderRadius: radius.lg,
            backgroundColor: '#EF444418',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="warning-outline" size={15} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="label" color="#EF4444">Memory Decay Alert</Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              {highRisk.length} topic{highRisk.length > 1 ? 's' : ''} predicted to decline
            </Typography>
          </View>
        </View>

        {/* Topic rows */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {display.map((topic) => {
            const drop = topic.currentAccuracy - topic.predictedAccuracyIn7Days;
            return (
              <View
                key={topic.topicSlug}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                <View style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: '#EF4444',
                }} />
                <View style={{ flex: 1 }}>
                  <Typography variant="bodySmall" color={theme.textSecondary} numberOfLines={1}>
                    {topic.topicName}
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                    {topic.subjectName}
                  </Typography>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                      {topic.currentAccuracy}%
                    </Typography>
                    <Typography variant="caption" color="#EF4444" style={{ fontSize: 11 }}>
                      → {topic.predictedAccuracyIn7Days}%
                    </Typography>
                  </View>
                  <Typography variant="caption" color="#EF4444" style={{ fontSize: 9 }}>
                    -{drop}% in 7d
                  </Typography>
                </View>
              </View>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => router.push('/review-queue')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Review at-risk topics"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: '#EF4444',
            borderRadius: radius.xl,
            paddingVertical: spacing.sm + 2,
          }}
        >
          <Ionicons name="refresh" size={14} color="#FFFFFF" />
          <Typography variant="label" color="#FFFFFF" style={{ fontSize: 12 }}>
            Review {totalReviewCards} Cards →
          </Typography>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
