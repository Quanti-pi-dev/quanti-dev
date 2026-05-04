// ─── Topic Mastery Overview ──────────────────────────────────
// Bird's-eye view of all topics within a subject, showing mastery
// percentage, highest level reached, and sorted by weakness.
// Accessible from the subject card on the home/study screens.

import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../../../src/theme';
import { spacing, radius } from '../../../../../src/theme/tokens';
import { ScreenWrapper } from '../../../../../src/components/layout/ScreenWrapper';
import { Header } from '../../../../../src/components/layout/Header';
import { Typography } from '../../../../../src/components/ui/Typography';
import { Skeleton } from '../../../../../src/components/ui/Skeleton';
import { fetchSubjectMastery, type TopicMasteryItem } from '../../../../../src/services/api-contracts';
import { LEVEL_COLOURS } from '../../../../../src/utils/constants';

// ─── Level badge config ──────────────────────────────────────
const LEVEL_LABELS: Record<number, string> = {
  0: 'Emerging',
  1: 'Developing',
  2: 'Proficient',
  3: 'Master',
};

const LEVEL_ICONS: Record<number, string> = {
  0: 'leaf-outline',
  1: 'rocket-outline',
  2: 'trophy-outline',
  3: 'diamond-outline',
};

// ─── Mastery color from percentage ───────────────────────────
function getMasteryColor(percent: number): string {
  if (percent >= 80) return '#10B981'; // green
  if (percent >= 50) return '#F59E0B'; // amber
  if (percent >= 20) return '#F97316'; // orange
  if (percent > 0) return '#EF4444';   // red
  return '#6B7280';                     // gray (not started)
}

// ─── Single topic row ────────────────────────────────────────
function TopicRow({
  topic,
  index,
  onPress,
}: {
  topic: TopicMasteryItem;
  index: number;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const color = getMasteryColor(topic.masteryPercent);
  const notStarted = topic.highestLevelIndex < 0;

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 50).duration(350)}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          borderRadius: radius.xl,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          gap: spacing.md,
        }}
      >
        {/* Mastery ring */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            borderWidth: 3,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark
              ? `${color}15`
              : `${color}10`,
          }}
        >
          <Typography
            variant="label"
            color={color}
            style={{ fontSize: 13, fontWeight: '700' }}
          >
            {notStarted ? '—' : `${topic.masteryPercent}%`}
          </Typography>
        </View>

        {/* Topic info */}
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="bodySemiBold" color={theme.text} numberOfLines={1}>
            {topic.topicName}
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {notStarted ? (
              <Typography variant="caption" color={theme.textTertiary}>
                Not started
              </Typography>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons
                    name={LEVEL_ICONS[topic.highestLevelIndex] as any ?? 'ellipse-outline'}
                    size={12}
                    color={LEVEL_COLOURS[topic.highestLevelIndex] ?? theme.textTertiary}
                  />
                  <Typography
                    variant="caption"
                    color={LEVEL_COLOURS[topic.highestLevelIndex] ?? theme.textTertiary}
                  >
                    {LEVEL_LABELS[topic.highestLevelIndex] ?? 'Unknown'}
                  </Typography>
                </View>
                <Typography variant="caption" color={theme.textTertiary}>
                  · {topic.correctAnswers} correct
                </Typography>
              </>
            )}
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ width: 60, gap: 2 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${topic.masteryPercent}%`,
                height: '100%',
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Summary Header ──────────────────────────────────────────
function MasterySummary({ topics }: { topics: TopicMasteryItem[] }) {
  const { theme, isDark } = useTheme();

  const total = topics.length;
  const started = topics.filter(t => t.highestLevelIndex >= 0).length;
  const mastered = topics.filter(t => t.masteryPercent >= 80).length;
  const avgMastery = total > 0
    ? Math.round(topics.reduce((sum, t) => sum + t.masteryPercent, 0) / total)
    : 0;

  return (
    <View
      style={{
        borderRadius: radius['2xl'],
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)',
      }}
    >
      <LinearGradient
        colors={isDark
          ? ['rgba(99,102,241,0.1)', 'rgba(16,185,129,0.06)']
          : ['rgba(99,102,241,0.06)', 'rgba(16,185,129,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.lg, gap: spacing.md }}
      >
        {/* Overall mastery */}
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Typography
            variant="h1"
            color={getMasteryColor(avgMastery)}
            style={{ fontSize: 36, fontWeight: '800' }}
          >
            {avgMastery}%
          </Typography>
          <Typography variant="body" color={theme.textSecondary}>
            Overall Mastery
          </Typography>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" color={theme.text}>{started}/{total}</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Started</Typography>
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" color="#10B981">{mastered}</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Strong</Typography>
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" color="#EF4444">{total - started}</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Not started</Typography>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function SubjectMasteryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { examId, subjectId, title } = useLocalSearchParams<{
    examId: string;
    subjectId: string;
    title: string;
  }>();

  const { data: topics, isLoading } = useQuery({
    queryKey: ['subjectMastery', examId, subjectId],
    queryFn: () => fetchSubjectMastery(examId!, subjectId!),
    enabled: !!examId && !!subjectId,
    staleTime: 30_000,
  });

  return (
    <ScreenWrapper>
      <Header showBack title={title ?? 'Topic Mastery'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing['4xl'],
          gap: spacing.md,
        }}
      >
        {isLoading ? (
          <>
            <Skeleton height={160} borderRadius={radius['2xl']} />
            {[0, 1, 2, 3, 4].map(i => (
              <Skeleton key={i} height={72} borderRadius={radius.xl} />
            ))}
          </>
        ) : topics && topics.length > 0 ? (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <MasterySummary topics={topics} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: spacing.sm,
              }}>
                <Typography variant="h4">Topics</Typography>
                <Typography variant="caption" color={theme.textTertiary}>
                  Sorted by weakness
                </Typography>
              </View>
            </Animated.View>

            {topics.map((topic: TopicMasteryItem, idx: number) => (
              <TopicRow
                key={topic.topicSlug}
                topic={topic}
                index={idx}
                onPress={() =>
                  router.push(
                    `/exams/${examId}/subjects/${subjectId}/levels?title=${encodeURIComponent(title ?? '')}` as never,
                  )
                }
              />
            ))}
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.lg }}>
            <Ionicons name="book-outline" size={48} color={theme.textTertiary} />
            <Typography variant="h3" align="center">No topics yet</Typography>
            <Typography variant="body" align="center" color={theme.textSecondary}>
              Start studying to see your mastery breakdown
            </Typography>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
