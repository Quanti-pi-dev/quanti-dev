// ─── FocusQualityScore ───────────────────────────────────────
// Post-session diagnostic that tells students HOW they studied,
// not just how many they got right.
// Computes a composite 0–100 score from 4 signals:
//   1. Accuracy Weight   (30%) — correctness adjusted for difficulty
//   2. Volume Score      (25%) — did they study enough cards?
//   3. Streak Consistency (25%) — longest correct streak / total
//   4. Skip Discipline   (20%) — not skipping is discipline

import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── Types ────────────────────────────────────────────────────

interface FocusQualityScoreProps {
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  /** Total cards in the session. */
  totalCards: number;
  /** Longest consecutive correct streak in this session (optional). */
  longestStreak?: number;
}

// ─── Score Computation ───────────────────────────────────────

function computeFocusScore(props: FocusQualityScoreProps) {
  const { correctCount, incorrectCount, skippedCount, totalCards, longestStreak = 0 } = props;
  const graded = correctCount + incorrectCount;

  // 1. Accuracy weight (0–100, 30%)
  const accuracy = graded > 0 ? (correctCount / graded) * 100 : 0;

  // 2. Volume score (0–100, 25%) — 15 cards = 100%, scales linearly
  const volumeTarget = 15;
  const volume = Math.min(100, (totalCards / volumeTarget) * 100);

  // 3. Streak consistency (0–100, 25%) — longest streak / total graded
  const streak = graded > 0 ? (longestStreak / graded) * 100 : 0;

  // 4. Skip discipline (0–100, 20%) — % of cards NOT skipped
  const skipDiscipline = totalCards > 0
    ? ((totalCards - skippedCount) / totalCards) * 100
    : 100;

  const composite = Math.round(
    accuracy * 0.30 +
    volume * 0.25 +
    streak * 0.25 +
    skipDiscipline * 0.20
  );

  return {
    overall: Math.min(100, composite),
    breakdown: [
      { label: 'Accuracy', score: Math.round(accuracy), weight: 30, icon: '🎯' as const },
      { label: 'Volume', score: Math.round(volume), weight: 25, icon: '📚' as const },
      { label: 'Streak', score: Math.round(streak), weight: 25, icon: '🔥' as const },
      { label: 'Discipline', score: Math.round(skipDiscipline), weight: 20, icon: '🧘' as const },
    ],
  };
}

function classifyFocus(score: number): { label: string; color: string; emoji: string } {
  if (score >= 85) return { label: 'Deep Focus', color: '#10B981', emoji: '🧠' };
  if (score >= 65) return { label: 'Solid Session', color: '#3B82F6', emoji: '💪' };
  if (score >= 40) return { label: 'Light Practice', color: '#F59E0B', emoji: '📖' };
  return { label: 'Shallow Pass', color: '#EF4444', emoji: '⚡' };
}

// ─── Component ────────────────────────────────────────────────

export function FocusQualityScore(props: FocusQualityScoreProps) {
  const { theme } = useTheme();
  const { overall, breakdown } = computeFocusScore(props);
  const { label, color, emoji } = classifyFocus(overall);

  return (
    <Animated.View
      entering={FadeInDown.delay(480).duration(400)}
      style={{ width: '100%' }}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: color + '30',
          gap: spacing.md,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: color + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography variant="bodyLarge">{emoji}</Typography>
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="label">Session Quality</Typography>
            <Typography variant="caption" color={color}>{label}</Typography>
          </View>
          <View style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
            backgroundColor: color + '15',
          }}>
            <Typography variant="h4" color={color}>{overall}</Typography>
          </View>
        </View>

        {/* Score bar */}
        <View style={{ gap: 4 }}>
          <View style={{
            height: 8, borderRadius: 4,
            backgroundColor: theme.border,
            overflow: 'hidden',
          }}>
            <View style={{
              width: `${overall}%` as any,
              height: '100%',
              borderRadius: 4,
              backgroundColor: color,
            }} />
          </View>
        </View>

        {/* Breakdown grid — 2x2 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {breakdown.map((item) => {
            const itemColor = item.score >= 70 ? '#10B981' : item.score >= 40 ? '#F59E0B' : '#EF4444';
            return (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  minWidth: '45%' as any,
                  backgroundColor: itemColor + '08',
                  borderRadius: radius.lg,
                  padding: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Typography variant="caption" style={{ fontSize: 14 }}>{item.icon}</Typography>
                <View style={{ flex: 1 }}>
                  <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 10 }}>
                    {item.label} ({item.weight}%)
                  </Typography>
                  <Typography variant="captionBold" color={itemColor}>{item.score}%</Typography>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}
