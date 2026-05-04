// ─── RecentDeckCard ───────────────────────────────────────────
// Slim, premium card for the "Pick Up Where You Left Off" section.
// Displays deck title, relative timestamp, accuracy, cards studied,
// a mini accuracy bar, and a "Resume" action button.

import { memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { radius, spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { useFadeInUp } from '../../theme/animations';
import Animated from 'react-native-reanimated';

// ─── Accent for accuracy color ───────────────────────────────

function accuracyColor(pct: number) {
  if (pct >= 80) return '#10B981';
  if (pct >= 60) return '#F59E0B';
  return '#EF4444';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Props ────────────────────────────────────────────────────

export interface RecentDeckCardProps {
  deckId: string;
  deckTitle: string;
  cardsStudied: number;
  correctAnswers: number;
  endedAt: string;
  onResume: (deckId: string) => void;
  index?: number;
}

// ─── Component ────────────────────────────────────────────────

export const RecentDeckCard = memo(function RecentDeckCard({
  deckId,
  deckTitle,
  cardsStudied,
  correctAnswers,
  endedAt,
  onResume,
  index = 0,
}: RecentDeckCardProps) {
  const { theme } = useTheme();
  const { animStyle } = useFadeInUp({ delay: Math.min(index * 60, 300) });

  const accuracy = cardsStudied > 0 ? Math.round((correctAnswers / cardsStudied) * 100) : 0;
  const accColor = accuracyColor(accuracy);
  const timeAgo = relativeTime(endedAt);

  return (
    <Animated.View style={animStyle}>
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius.xl,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: theme.border,
          gap: spacing.sm,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Main row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Icon badge */}
          <View
            style={{
              width: 44, height: 44, borderRadius: radius.lg,
              backgroundColor: theme.primaryMuted,
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ionicons name="layers-outline" size={20} color={theme.primary} />
          </View>

          {/* Info block */}
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="label" numberOfLines={1}>{deckTitle}</Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="time-outline" size={11} color={theme.textTertiary} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                {timeAgo}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>·</Typography>
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                {cardsStudied} cards
              </Typography>
            </View>
          </View>

          {/* Resume button */}
          <TouchableOpacity
            onPress={() => onResume(deckId)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={`Resume ${deckTitle}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.primary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.full,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Typography variant="captionBold" color="#FFF" style={{ fontSize: 11 }}>Resume</Typography>
            <Ionicons name="play" size={10} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Accuracy row with bar */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={12} color={accColor} />
              <Typography variant="caption" color={accColor} style={{ fontSize: 11, fontWeight: '700' }}>
                {accuracy}% accuracy
              </Typography>
            </View>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              {correctAnswers}/{cardsStudied} correct
            </Typography>
          </View>
          {/* Mini accuracy bar */}
          <View
            style={{
              height: 4, borderRadius: 2,
              backgroundColor: accColor + '20',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${accuracy}%`,
                backgroundColor: accColor,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
});
