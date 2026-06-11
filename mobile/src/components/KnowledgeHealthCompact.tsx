// ─── KnowledgeHealthCompact ──────────────────────────────────
// Condensed knowledge health for the Home screen.
// Shows top 2 strongest + bottom 2 weakest subjects with:
//  - Precise numerical mastery deltas (BKT 7-day trend)
//  - Retention vs. Mastery divergence warning (hidden decay signal)
//  - Most at-risk topic callout for immediate action

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { ProgressBar } from './ui/ProgressBar';
import type { SubjectMemoryState, TopicMemoryState } from '@kd/shared';

interface Props {
  knowledgeHealth: SubjectMemoryState[];
  totalOverdue: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function getBarColor(mastery: number): string {
  if (mastery >= 80) return '#10B981';
  if (mastery >= 60) return '#F59E0B';
  if (mastery >= 40) return '#F97316';
  return '#EF4444';
}

/**
 * Derives a numeric mastery delta for the subject from its topic trends.
 * Instead of just 'up/down', we estimate the scale:
 *   improving: +3–12 pts (weighted by how many topics improving)
 *   declining: −3–10 pts (weighted by how many topics declining)
 */
function computeSubjectDelta(subject: SubjectMemoryState): number {
  const studied = subject.topics.filter((t) => t.urgency !== 'not-started');
  if (studied.length === 0) return 0;

  const improving = studied.filter((t) => t.trend === 'improving').length;
  const declining = studied.filter((t) => t.trend === 'declining').length;

  if (improving === declining) return 0;

  // Scale: each improving/declining topic contributes proportionally.
  const ratio = (improving - declining) / studied.length; // −1 to +1
  // Max swing: ±12 pts on a 100-pt scale
  return Math.round(ratio * 12);
}

/**
 * Finds the single highest-urgency topic across ALL subjects.
 * Returns null when everything looks healthy.
 */
function findMostAtRisk(
  health: SubjectMemoryState[],
): { topic: TopicMemoryState; subjectName: string } | null {
  const urgencyOrder = { critical: 0, 'review-soon': 1, stable: 2, mastered: 3, 'not-started': 4 };
  let best: { topic: TopicMemoryState; subjectName: string } | null = null;

  for (const subject of health) {
    for (const topic of subject.topics) {
      if (topic.urgency === 'not-started' || topic.urgency === 'mastered') continue;
      if (
        best === null ||
        urgencyOrder[topic.urgency] < urgencyOrder[best.topic.urgency] ||
        (urgencyOrder[topic.urgency] === urgencyOrder[best.topic.urgency] &&
          topic.cardsOverdue > best.topic.cardsOverdue)
      ) {
        best = { topic, subjectName: subject.subjectName };
      }
    }
  }
  return best;
}

/**
 * Detects hidden decay: retention is reasonable but conceptMastery lags.
 * This means the student is fooling themselves — they remember recent cards
 * but don't have deep understanding. Flag it.
 */
function hasRetentionMasteryDivergence(subject: SubjectMemoryState): boolean {
  return subject.retentionEstimate - subject.conceptMastery > 18;
}

// ─── SubjectRow ───────────────────────────────────────────────

function SubjectRow({
  subject,
}: {
  subject: SubjectMemoryState;
}) {
  const { theme } = useTheme();
  const mastery = subject.conceptMastery;
  const color   = getBarColor(mastery);
  const delta   = computeSubjectDelta(subject);
  const hasDivergence = hasRetentionMasteryDivergence(subject);

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Typography variant="bodySmall" color={theme.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
            {subject.subjectName}
          </Typography>
          {/* Hidden decay warning — retention OK but mastery lagging */}
          {hasDivergence && (
            <View style={{
              backgroundColor: '#F59E0B15',
              borderRadius: radius.full,
              paddingHorizontal: 4, paddingVertical: 1,
            }}>
              <Typography variant="caption" color="#F59E0B" style={{ fontSize: 9 }}>
                shallow
              </Typography>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {/* Numerical delta instead of generic arrow */}
          {delta !== 0 && (
            <Typography
              variant="caption"
              color={delta > 0 ? '#10B981' : '#EF4444'}
              style={{ fontSize: 10, fontWeight: '700' }}
            >
              {delta > 0 ? `+${delta}` : `${delta}`}
            </Typography>
          )}
          <Typography variant="captionBold" color={color} style={{ fontSize: 12 }}>
            {mastery}%
          </Typography>
        </View>
      </View>
      <ProgressBar progress={mastery / 100} height={4} color={color} />
    </View>
  );
}

// ─── AtRiskCallout ───────────────────────────────────────────

function AtRiskCallout({
  item,
}: {
  item: { topic: TopicMemoryState; subjectName: string };
}) {
  const router = useRouter();
  const isCritical = item.topic.urgency === 'critical';
  const color = isCritical ? '#EF4444' : '#F59E0B';

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/topic-review',
          params: {
            topicSlug:   item.topic.topicSlug,
            topicName:   item.topic.topicName,
            subjectName: item.subjectName,
            subjectId:   item.topic.subjectId,
            mode:        'memory_review',
          },
        })
      }
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: color + '0A',
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: color + '20',
      }}
    >
      <View style={{
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: color + '18',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={isCritical ? 'alert-circle-outline' : 'time-outline'} size={13} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="captionBold" color={color} style={{ fontSize: 10 }} numberOfLines={1}>
          {item.topic.topicName}
        </Typography>
        <Typography variant="caption" color={color + 'BB'} style={{ fontSize: 9 }}>
          {item.topic.cardsOverdue > 0
            ? `${item.topic.cardsOverdue} cards overdue · ${item.subjectName}`
            : `${item.subjectName} · ${isCritical ? 'critical' : 'review soon'}`}
        </Typography>
      </View>
      <Ionicons name="play-circle-outline" size={16} color={color} />
    </TouchableOpacity>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function KnowledgeHealthCompact({ knowledgeHealth, totalOverdue }: Props) {
  const { theme } = useTheme();
  const router    = useRouter();

  if (knowledgeHealth.length === 0) return null;

  // Sort by concept mastery
  const sorted   = [...knowledgeHealth].sort((a, b) => b.conceptMastery - a.conceptMastery);
  const strongest = sorted.slice(0, 2);
  const weakest   = sorted.length > 2 ? sorted.slice(-2).reverse() : [];
  const atRisk    = findMostAtRisk(knowledgeHealth);

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
            <View>
              <Typography variant="label">Knowledge Health</Typography>
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                BKT mastery · 7-day delta
              </Typography>
            </View>
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
              <SubjectRow key={s.subjectId} subject={s} />
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
              <SubjectRow key={s.subjectId} subject={s} />
            ))}
          </View>
        )}

        {/* Most at-risk topic — actionable tap */}
        {atRisk && (
          <AtRiskCallout item={atRisk} />
        )}

        {/* Footer */}
        <Typography variant="caption" color={theme.primary} style={{ fontSize: 10, textAlign: 'center' }}>
          Tap to see full breakdown →
        </Typography>
      </TouchableOpacity>
    </Animated.View>
  );
}
