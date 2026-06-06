// ─── KnowledgeHealthCompact ──────────────────────────────────
// Condensed knowledge health for the Home screen.
// Shows top 2 strongest + bottom 2 weakest subjects from the
// full KnowledgeHealthMap data with a single-tap deep link.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { ProgressBar } from './ui/ProgressBar';
import type { SubjectMemoryState } from '@kd/shared';

interface Props {
  knowledgeHealth: SubjectMemoryState[];
  totalOverdue: number;
}

function SubjectRow({ name, mastery, color, trend }: {
  name: string;
  mastery: number;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}) {
  const { theme } = useTheme();
  const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '';
  const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : theme.textTertiary;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="bodySmall" color={theme.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Typography variant="captionBold" color={color} style={{ fontSize: 12 }}>
            {mastery}%
          </Typography>
          {trendIcon !== '' && (
            <Typography variant="caption" color={trendColor} style={{ fontSize: 10 }}>
              {trendIcon}
            </Typography>
          )}
        </View>
      </View>
      <ProgressBar progress={mastery / 100} height={4} color={color} />
    </View>
  );
}

function getBarColor(mastery: number): string {
  if (mastery >= 80) return '#10B981';
  if (mastery >= 60) return '#F59E0B';
  if (mastery >= 40) return '#F97316';
  return '#EF4444';
}

function getSubjectTrend(subject: SubjectMemoryState): 'up' | 'down' | 'stable' {
  // Derive trend from majority of topic trends
  const topics = subject.topics.filter(t => t.urgency !== 'not-started');
  if (topics.length === 0) return 'stable';
  const improving = topics.filter(t => t.trend === 'improving').length;
  const declining = topics.filter(t => t.trend === 'declining').length;
  if (improving > declining) return 'up';
  if (declining > improving) return 'down';
  return 'stable';
}

export function KnowledgeHealthCompact({ knowledgeHealth, totalOverdue }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  if (knowledgeHealth.length === 0) return null;

  // Sort by concept mastery
  const sorted = [...knowledgeHealth].sort((a, b) => b.conceptMastery - a.conceptMastery);
  const strongest = sorted.slice(0, 2);
  const weakest = sorted.length > 2
    ? sorted.slice(-2).reverse() // weakest first
    : [];

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(350)}>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/progress')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View full knowledge health map"
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: theme.border,
          gap: spacing.md,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              width: 28, height: 28, borderRadius: radius.lg,
              backgroundColor: '#6366F115',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography style={{ fontSize: 14 }}>🧠</Typography>
            </View>
            <Typography variant="label">Knowledge Health</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {totalOverdue > 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: '#EF444412', borderRadius: radius.full,
                paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' }} />
                <Typography variant="caption" color="#EF4444" style={{ fontSize: 10 }}>
                  {totalOverdue} overdue
                </Typography>
              </View>
            )}
            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
          </View>
        </View>

        {/* Strongest */}
        {strongest.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              💪 Strongest
            </Typography>
            {strongest.map((s) => (
              <SubjectRow
                key={s.subjectId}
                name={s.subjectName}
                mastery={s.conceptMastery}
                color={getBarColor(s.conceptMastery)}
                trend={getSubjectTrend(s)}
              />
            ))}
          </View>
        )}

        {/* Weakest */}
        {weakest.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              ⚠️ Needs Work
            </Typography>
            {weakest.map((s) => (
              <SubjectRow
                key={s.subjectId}
                name={s.subjectName}
                mastery={s.conceptMastery}
                color={getBarColor(s.conceptMastery)}
                trend={getSubjectTrend(s)}
              />
            ))}
          </View>
        )}

        {/* Footer */}
        <Typography variant="caption" color={theme.primary} style={{ fontSize: 10, textAlign: 'center' }}>
          Tap to see full breakdown →
        </Typography>
      </TouchableOpacity>
    </Animated.View>
  );
}
