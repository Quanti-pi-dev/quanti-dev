// ─── Error Journal Screen ────────────────────────────────────
// Shows wrong answers the student has made, enriched with the
// original question + correct/wrong answer highlights.
// Students can review and dismiss entries once understood.

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Typography } from '../src/components/ui/Typography';
import { Skeleton } from '../src/components/ui/Skeleton';
import { Button } from '../src/components/ui/Button';
import {
  fetchErrorJournal,
  dismissErrorJournalEntry,
  type ErrorJournalEntry,
} from '../src/services/api-contracts';

// ─── Answer pill ─────────────────────────────────────────────

function AnswerPill({
  text,
  isCorrect,
  isSelected,
}: {
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
}) {
  const { theme, isDark } = useTheme();

  const bg = isCorrect
    ? (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)')
    : isSelected
      ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
      : theme.cardAlt;
  const border = isCorrect ? '#10B981' : isSelected ? '#EF4444' : theme.border;
  const textColor = isCorrect ? '#10B981' : isSelected ? '#EF4444' : theme.textSecondary;
  const icon = isCorrect ? 'checkmark-circle' : isSelected ? 'close-circle' : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border + '40',
      }}
    >
      {icon && <Ionicons name={icon as any} size={16} color={border} />}
      <Typography variant="caption" color={textColor} style={{ flex: 1 }}>
        {text}
      </Typography>
    </View>
  );
}

// ─── Single error card ───────────────────────────────────────

function ErrorCard({
  entry,
  index,
  onDismiss,
  isDismissing,
}: {
  entry: ErrorJournalEntry;
  index: number;
  onDismiss: (cardId: string) => void;
  isDismissing: boolean;
}) {
  const { theme, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const ago = getTimeAgo(entry.timestamp);

  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 50).duration(300)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
        }}
      >
        {/* Header — always visible */}
        <TouchableOpacity
          onPress={() => setExpanded(v => !v)}
          activeOpacity={0.8}
          style={{
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.md,
          }}
        >
          {/* Error indicator */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.lg,
              backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 2,
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Typography variant="bodySemiBold" color={theme.text} numberOfLines={expanded ? undefined : 2}>
              {entry.question}
            </Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                {entry.subjectName}
              </Typography>
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                {entry.topicName}
              </Typography>
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary + '60' }} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                {ago}
              </Typography>
            </View>
          </View>

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textTertiary}
            style={{ marginTop: 4 }}
          />
        </TouchableOpacity>

        {/* Expanded — show answers + dismiss */}
        {expanded && (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
            <View style={{ height: 1, backgroundColor: theme.border, marginBottom: spacing.xs }} />

            <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: 2 }}>
              Answers:
            </Typography>

            {entry.answers.map(answer => (
              <AnswerPill
                key={answer.id}
                text={answer.text}
                isCorrect={answer.id === entry.correctAnswerId}
                isSelected={answer.id === entry.selectedAnswerId}
              />
            ))}

            {/* Level badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                }}
              >
                <Typography variant="caption" color="#6366F1" style={{ fontSize: 10 }}>
                  {entry.level}
                </Typography>
              </View>
            </View>

            {/* Dismiss button */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss(entry.cardId);
              }}
              disabled={isDismissing}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)',
                borderWidth: 1,
                borderColor: '#10B98125',
                marginTop: spacing.xs,
              }}
            >
              <Ionicons name="checkmark-done" size={16} color="#10B981" />
              <Typography variant="label" color="#10B981">
                {isDismissing ? 'Removing…' : 'Got it — remove from journal'}
              </Typography>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Empty state ─────────────────────────────────────────────

function EmptyJournal() {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.lg, paddingHorizontal: spacing.xl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(16,185,129,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
      </View>
      <Typography variant="h3" align="center">No errors yet!</Typography>
      <Typography variant="body" align="center" color={theme.textSecondary}>
        Your error journal will fill up as you study. Wrong answers appear here so you can review and learn from them.
      </Typography>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function ErrorJournalScreen() {
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ['errorJournal'],
    queryFn: fetchErrorJournal,
    staleTime: 30_000,
  });

  const dismissMutation = useMutation({
    mutationFn: dismissErrorJournalEntry,
    onMutate: (cardId) => setDismissingId(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['errorJournal'] });
      setDismissingId(null);
    },
    onError: () => setDismissingId(null),
  });

  const errorCount = entries?.length ?? 0;

  // Group by subject for the summary
  const subjectGroups = new Map<string, number>();
  for (const e of entries ?? []) {
    subjectGroups.set(e.subjectName, (subjectGroups.get(e.subjectName) ?? 0) + 1);
  }

  return (
    <ScreenWrapper>
      <Header showBack title="Error Journal" />

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
            <Skeleton height={100} borderRadius={radius['2xl']} />
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height={90} borderRadius={radius['2xl']} />
            ))}
          </>
        ) : errorCount === 0 ? (
          <EmptyJournal />
        ) : (
          <>
            {/* Summary header */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <View
                style={{
                  borderRadius: radius['2xl'],
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                }}
              >
                <LinearGradient
                  colors={isDark
                    ? ['rgba(239,68,68,0.08)', 'rgba(249,115,22,0.04)']
                    : ['rgba(239,68,68,0.05)', 'rgba(249,115,22,0.02)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: spacing.lg, gap: spacing.sm }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="journal-outline" size={20} color="#EF4444" />
                    <Typography variant="bodySemiBold" color={theme.text}>
                      {errorCount} mistake{errorCount !== 1 ? 's' : ''} to review
                    </Typography>
                  </View>

                  <Typography variant="caption" color={theme.textSecondary}>
                    Tap a card to see the correct answer. Dismiss once you've understood it.
                  </Typography>

                  {/* Subject breakdown chips */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                    {[...subjectGroups.entries()].map(([name, count]) => (
                      <View
                        key={name}
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 3,
                          borderRadius: radius.full,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        }}
                      >
                        <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
                          {name}: {count}
                        </Typography>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </View>
            </Animated.View>

            {/* Error cards */}
            {(entries ?? []).map((entry, idx) => (
              <ErrorCard
                key={`${entry.cardId}-${entry.timestamp}`}
                entry={entry}
                index={idx}
                onDismiss={(cardId) => dismissMutation.mutate(cardId)}
                isDismissing={dismissingId === entry.cardId}
              />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
