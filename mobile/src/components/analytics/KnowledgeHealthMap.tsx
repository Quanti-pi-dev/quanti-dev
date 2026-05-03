// ─── KnowledgeHealthMap ──────────────────────────────────────
// Visualizes memory state per subject → topic. Shows retention
// levels, mastery labels, trend indicators, and overdue card counts.

import { useState } from 'react';
import { View, Pressable, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { SubjectMemoryState, TopicMemoryState } from '@kd/shared';

// ─── Constants ────────────────────────────────────────────────

const URGENCY_CONFIG = {
  critical: { color: '#EF4444', icon: '🔴', label: 'Review now' },
  'review-soon': { color: '#F59E0B', icon: '⚠️', label: 'Review soon' },
  stable: { color: '#10B981', icon: '✅', label: 'Stable' },
  mastered: { color: '#6366F1', icon: '💎', label: 'Mastered' },
} as const;

const TREND_ICONS = {
  improving: { icon: '↗', color: '#10B981', label: 'Improving' },
  stable: { icon: '→', color: '#94A3B8', label: 'Stable' },
  declining: { icon: '↘', color: '#EF4444', label: 'Declining' },
} as const;

function getMasteryLabel(retention: number): { label: string; color: string } {
  if (retention >= 85) return { label: 'Master', color: '#6366F1' };
  if (retention >= 60) return { label: 'Proficient', color: '#10B981' };
  if (retention >= 40) return { label: 'Developing', color: '#F59E0B' };
  return { label: 'Emerging', color: '#F97316' };
}

// ─── Topic Row ───────────────────────────────────────────────

function TopicHealthRow({ topic }: { topic: TopicMemoryState }) {
  const { theme } = useTheme();
  const urgencyCfg = URGENCY_CONFIG[topic.urgency];
  const trendCfg = TREND_ICONS[topic.trend];
  const mastery = getMasteryLabel(topic.retentionEstimate);

  const barColor =
    topic.retentionEstimate >= 80 ? '#10B981' :
    topic.retentionEstimate >= 60 ? '#F59E0B' :
    topic.retentionEstimate >= 40 ? '#F97316' : '#EF4444';

  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <View
        style={{
          gap: 6,
          paddingLeft: spacing.base,
          paddingVertical: spacing.xs,
          borderLeftWidth: 2,
          borderLeftColor: urgencyCfg.color + '40',
          marginLeft: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="bodySmall" style={{ flex: 1 }} numberOfLines={1} color={theme.textSecondary}>
            {topic.topicName}
          </Typography>

          {/* Retention % */}
          <Typography variant="captionBold" color={barColor} style={{ fontSize: 12 }}>
            {topic.retentionEstimate}%
          </Typography>

          {/* Trend badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              backgroundColor: trendCfg.color + '10',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: radius.full,
            }}
          >
            <Typography variant="caption" color={trendCfg.color} style={{ fontSize: 10 }}>
              {trendCfg.icon}
            </Typography>
          </View>
        </View>

        <ProgressBar
          progress={topic.retentionEstimate / 100}
          height={4}
          color={barColor}
        />

        {topic.cardsOverdue > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' }} />
            <Typography variant="caption" color="#EF4444" style={{ fontSize: 10 }}>
              {topic.cardsOverdue} card{topic.cardsOverdue > 1 ? 's' : ''} overdue
            </Typography>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Subject Section ─────────────────────────────────────────

function SubjectHealthSection({
  subject,
  isExpanded,
  onToggle,
}: {
  subject: SubjectMemoryState;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const mastery = getMasteryLabel(subject.retentionEstimate);

  const retentionColor =
    subject.retentionEstimate >= 80 ? '#10B981' :
    subject.retentionEstimate >= 60 ? '#F59E0B' :
    subject.retentionEstimate >= 40 ? '#F97316' : '#EF4444';

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          backgroundColor: isExpanded ? retentionColor + '06' : 'transparent',
          borderRadius: radius.lg,
        }}
      >
        <Ionicons
          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={theme.textTertiary}
        />
        <Typography variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {subject.subjectName}
        </Typography>

        {/* Mastery level chip */}
        <View
          style={{
            backgroundColor: mastery.color + '12',
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: mastery.color + '20',
          }}
        >
          <Typography variant="captionBold" color={mastery.color} style={{ fontSize: 10, letterSpacing: 0.3 }}>
            {mastery.label}
          </Typography>
        </View>

        {/* Retention badge */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: retentionColor + '12',
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: retentionColor,
            }}
          />
          <Typography variant="captionBold" color={retentionColor} style={{ fontSize: 11 }}>
            {subject.retentionEstimate}%
          </Typography>
        </View>
      </Pressable>

      {/* Subject-level progress bar */}
      <View style={{ paddingHorizontal: spacing.sm }}>
        <ProgressBar
          progress={subject.retentionEstimate / 100}
          height={5}
          color={retentionColor}
        />
      </View>

      {/* Overdue summary */}
      {subject.totalOverdue > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingLeft: spacing.lg,
          }}
        >
          <Ionicons name="alert-circle-outline" size={11} color="#EF4444" />
          <Typography variant="caption" color="#EF4444" style={{ fontSize: 10 }}>
            {subject.totalOverdue} overdue · {subject.totalDueSoon} due soon
          </Typography>
        </View>
      )}

      {/* Expanded topic list */}
      {isExpanded && (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {subject.topics.map((topic) => (
            <TopicHealthRow key={topic.topicSlug} topic={topic} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface KnowledgeHealthMapProps {
  data: SubjectMemoryState[];
  totalOverdue: number;
  totalDueSoon?: number;
}

export function KnowledgeHealthMap({ data, totalOverdue, totalDueSoon }: KnowledgeHealthMapProps) {
  const { theme } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (data.length === 0) {
    return (
      <Card>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#6366F115',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="bulb-outline" size={26} color="#6366F1" />
          </View>
          <Typography variant="label" color={theme.textSecondary} align="center">
            Start studying to build your knowledge map
          </Typography>
          <Typography variant="caption" color={theme.textTertiary} align="center" style={{ lineHeight: 18 }}>
            Your memory health will appear here as you study flashcards
          </Typography>
        </View>
      </Card>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <Card>
        <View style={{ gap: spacing.md }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.lg,
                  backgroundColor: '#6366F115',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography style={{ fontSize: 14 }}>🧠</Typography>
              </View>
              <View>
                <Typography variant="label">Knowledge Health</Typography>
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                  Memory retention by subject
                </Typography>
              </View>
            </View>
            {totalOverdue > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#EF444415',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: '#EF444420',
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                <Typography variant="captionBold" color="#EF4444" style={{ fontSize: 11 }}>
                  {totalOverdue} overdue
                </Typography>
              </View>
            )}
          </View>

          {/* Mastery legend */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Emerging', color: '#F97316' },
              { label: 'Developing', color: '#F59E0B' },
              { label: 'Proficient', color: '#10B981' },
              { label: 'Master', color: '#6366F1' },
            ].map((level) => (
              <View
                key={level.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: level.color }} />
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
                  {level.label}
                </Typography>
              </View>
            ))}
          </View>

          {/* Subject sections */}
          {data.map((subject, i) => (
            <SubjectHealthSection
              key={subject.subjectId}
              subject={subject}
              isExpanded={expandedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
            />
          ))}

          {/* Footer summary */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.border + '30',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' }} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                {totalOverdue} overdue
              </Typography>
            </View>
            <Typography variant="caption" color={theme.textTertiary + '40'} style={{ fontSize: 10 }}>
              ·
            </Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#F59E0B' }} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                {totalDueSoon ?? 0} due soon
              </Typography>
            </View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}
