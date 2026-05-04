// ─── Review Queue Screen ─────────────────────────────────────
// Shows cards due for SM-2 spaced repetition review, sorted by
// most overdue first. Supports PYQ-only filter toggle.
// Accessible from the Progress tab and Home screen.

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Typography } from '../src/components/ui/Typography';
import { Skeleton } from '../src/components/ui/Skeleton';
import {
  fetchReviewQueue,
  type ReviewQueueCard,
} from '../src/services/api-contracts';

// ─── Urgency helpers ─────────────────────────────────────────

function getUrgencyColor(overdueDays: number): string {
  if (overdueDays >= 7) return '#EF4444';
  if (overdueDays >= 3) return '#F97316';
  if (overdueDays >= 1) return '#F59E0B';
  return '#10B981';
}

function getUrgencyLabel(overdueDays: number): string {
  if (overdueDays >= 7) return `${Math.round(overdueDays)}d overdue — critical`;
  if (overdueDays >= 3) return `${Math.round(overdueDays)}d overdue`;
  if (overdueDays >= 1) return `${Math.round(overdueDays)}d overdue`;
  return 'Due now';
}

// ─── PYQ Badge ───────────────────────────────────────────────

function PYQBadge({ year, paper }: { year?: number | null; paper?: string | null }) {
  if (!year) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: '#8B5CF618',
      }}
    >
      <Ionicons name="document-text-outline" size={10} color="#8B5CF6" />
      <Typography variant="caption" color="#8B5CF6" style={{ fontSize: 10 }}>
        PYQ {year}{paper ? ` · ${paper}` : ''}
      </Typography>
    </View>
  );
}

// ─── Single card row ─────────────────────────────────────────

function ReviewCardRow({
  card,
  index,
  onPress,
}: {
  card: ReviewQueueCard;
  index: number;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const color = getUrgencyColor(card.overdueDays);

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 40).duration(300)}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: theme.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: theme.border,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        {/* Top row: urgency + subject */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
              }}
            />
            <Typography variant="caption" color={color} style={{ fontSize: 11 }}>
              {getUrgencyLabel(card.overdueDays)}
            </Typography>
          </View>
          <PYQBadge year={card.sourceYear} paper={card.sourcePaper} />
        </View>

        {/* Question */}
        <Typography variant="bodySemiBold" color={theme.text} numberOfLines={2}>
          {card.question}
        </Typography>

        {/* Meta row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
            {card.subjectName}
          </Typography>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
            {card.topicName}
          </Typography>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
            {card.repetitions} reviews
          </Typography>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Filter toggle ───────────────────────────────────────────

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: active
          ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)')
          : theme.cardAlt,
        borderWidth: 1,
        borderColor: active ? theme.primary + '40' : theme.border,
      }}
    >
      <Ionicons name={icon as any} size={14} color={active ? theme.primary : theme.textSecondary} />
      <Typography
        variant="caption"
        color={active ? theme.primary : theme.textSecondary}
        style={{ fontWeight: active ? '600' : '400' }}
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function ReviewQueueScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [pyqOnly, setPyqOnly] = useState(false);

  const { data: allCards, isLoading: loadingAll } = useQuery({
    queryKey: ['reviewQueue', 'all'],
    queryFn: () => fetchReviewQueue(),
    staleTime: 30_000,
  });

  const { data: pyqCards, isLoading: loadingPyq } = useQuery({
    queryKey: ['reviewQueue', 'pyq'],
    queryFn: () => fetchReviewQueue('pyq'),
    staleTime: 30_000,
    enabled: pyqOnly,
  });

  const cards = pyqOnly ? (pyqCards ?? []) : (allCards ?? []);
  const isLoading = pyqOnly ? loadingPyq : loadingAll;
  const totalDue = allCards?.length ?? 0;
  const pyqCount = pyqOnly ? (pyqCards?.length ?? 0) : (allCards?.filter(c => c.source === 'pyq').length ?? 0);

  // Group by urgency
  const critical = cards.filter(c => c.overdueDays >= 7);
  const moderate = cards.filter(c => c.overdueDays >= 1 && c.overdueDays < 7);
  const fresh = cards.filter(c => c.overdueDays < 1);

  return (
    <ScreenWrapper>
      <Header showBack title="Review Queue" />

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
            <Skeleton height={140} borderRadius={radius['2xl']} />
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} height={100} borderRadius={radius.xl} />
            ))}
          </>
        ) : totalDue === 0 ? (
          /* ── Empty state ── */
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.lg }}>
            <View
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: 'rgba(16,185,129,0.1)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark-done-circle-outline" size={32} color="#10B981" />
            </View>
            <Typography variant="h3" align="center">All caught up! 🎉</Typography>
            <Typography variant="body" align="center" color={theme.textSecondary}>
              No cards are due for review right now. Keep studying and they'll appear here based on spaced repetition.
            </Typography>
          </View>
        ) : (
          <>
            {/* Summary header */}
            <Animated.View entering={FadeInDown.duration(400)}>
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
                    ? ['rgba(99,102,241,0.1)', 'rgba(245,158,11,0.05)']
                    : ['rgba(99,102,241,0.06)', 'rgba(245,158,11,0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: spacing.lg, gap: spacing.md }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="refresh-circle-outline" size={20} color={theme.primary} />
                    <Typography variant="bodySemiBold" color={theme.text}>
                      {totalDue} card{totalDue !== 1 ? 's' : ''} due for review
                    </Typography>
                  </View>

                  {/* Stats */}
                  <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                    {critical.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                        <Typography variant="caption" color="#EF4444">{critical.length} critical</Typography>
                      </View>
                    )}
                    {moderate.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                        <Typography variant="caption" color="#F59E0B">{moderate.length} overdue</Typography>
                      </View>
                    )}
                    {fresh.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                        <Typography variant="caption" color="#10B981">{fresh.length} due now</Typography>
                      </View>
                    )}
                  </View>

                  <Typography variant="caption" color={theme.textSecondary}>
                    Reviewing overdue cards first helps maximize your retention.
                  </Typography>
                </LinearGradient>
              </View>
            </Animated.View>

            {/* Filter chips */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <FilterChip
                  label="All Cards"
                  icon="layers-outline"
                  active={!pyqOnly}
                  onPress={() => setPyqOnly(false)}
                />
                <FilterChip
                  label={`PYQ Only${pyqCount > 0 ? ` (${pyqCount})` : ''}`}
                  icon="document-text-outline"
                  active={pyqOnly}
                  onPress={() => setPyqOnly(true)}
                />
              </View>
            </Animated.View>

            {/* Card list */}
            {cards.map((card, idx) => (
              <ReviewCardRow
                key={card.cardId}
                card={card}
                index={idx}
                onPress={() => {
                  // Navigate to study the card in its original deck context.
                  // Uses deck-mode (not level-mode) so SM-2/BKT updates happen
                  // via useStudySession's answer flush without inflating any
                  // specific level's statistics.
                  if (card.deckId) {
                    router.push(
                      `/flashcards/${card.deckId}?title=Review` as never,
                    );
                  }
                }}
              />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
