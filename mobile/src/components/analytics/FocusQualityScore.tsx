// ─── FocusQualityScore ───────────────────────────────────────
// Post-session diagnostic that tells students HOW they studied,
// not just how many they got right.
//
// Signal weights (6 signals, ML-augmented when mlMeta is provided):
//   1. Accuracy         (25%) — correctness
//   2. Volume           (20%) — enough cards studied?
//   3. Streak           (20%) — consecutive correct streak
//   4. Discipline       (15%) — not skipping
//   5. Difficulty Bonus (15%) — tackled hard material (DKT pDifficult)
//   6. Persistence      ( 5%) — finished despite high dropout risk
//
// Without mlMeta, signals 5 & 6 are absent and weights revert to
// the original 4-signal distribution (30/25/25/20).

import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── Types ────────────────────────────────────────────────────

/** Subset of PlannedStudySession.mlMeta relevant to the quality score. */
export interface SessionMlMeta {
  /** 0–1 probability that the session cards were "difficult" (from DKT / SAKT). */
  pDifficult: number;
  /** 0–1 predicted dropout probability BEFORE the session started. */
  dropoutRisk: number;
  /** Which model powered this session. */
  model: 'dkt' | 'sakt' | 'bkt';
}

interface FocusQualityScoreProps {
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  /** Total cards in the session. */
  totalCards: number;
  /** Longest consecutive correct streak in this session (optional). */
  longestStreak?: number;
  /**
   * Optional ML metadata forwarded from the study plan.
   * When present, enables Difficulty Bonus and Persistence signals.
   */
  mlMeta?: SessionMlMeta;
}

// ─── Score Computation ───────────────────────────────────────

function computeFocusScore(props: FocusQualityScoreProps) {
  const {
    correctCount, incorrectCount, skippedCount,
    totalCards, longestStreak = 0, mlMeta,
  } = props;
  const graded = correctCount + incorrectCount;

  // 1. Accuracy (0–100)
  const accuracy = graded > 0 ? (correctCount / graded) * 100 : 0;

  // 2. Volume (0–100) — 15 cards = full score
  const volumeTarget = 15;
  const volume = Math.min(100, (totalCards / volumeTarget) * 100);

  // 3. Streak consistency (0–100)
  const streak = graded > 0 ? (longestStreak / graded) * 100 : 0;

  // 4. Skip discipline (0–100) — % of cards NOT skipped
  const skipDiscipline = totalCards > 0
    ? ((totalCards - skippedCount) / totalCards) * 100
    : 100;

  if (!mlMeta) {
    // ── Fallback: original 4-signal formula ──────────────────
    const composite = Math.round(
      accuracy      * 0.30 +
      volume        * 0.25 +
      streak        * 0.25 +
      skipDiscipline * 0.20,
    );
    return {
      overall: Math.min(100, composite),
      mlPowered: false,
      modelLabel: null as string | null,
      breakdown: [
        { label: 'Accuracy',    score: Math.round(accuracy),      weight: 30, icon: '🎯' as const },
        { label: 'Volume',      score: Math.round(volume),        weight: 25, icon: '📚' as const },
        { label: 'Streak',      score: Math.round(streak),        weight: 25, icon: '🔥' as const },
        { label: 'Discipline',  score: Math.round(skipDiscipline),weight: 20, icon: '🧘' as const },
      ],
    };
  }

  // ── ML-augmented formula (6 signals) ────────────────────────

  // 5. Difficulty Bonus — pDifficult ∈ [0,1] → 0-100
  //    Caps at 80 so an "easy" session can still score well overall.
  const difficultyBonus = Math.min(80, mlMeta.pDifficult * 100);

  // 6. Persistence Bonus — 100 if dropout risk was high (≥ 0.55)
  //    and student completed the session anyway. Celebrates grit.
  const persistenceBonus = mlMeta.dropoutRisk >= 0.55 ? 100 : 0;

  const composite = Math.round(
    accuracy       * 0.25 +
    volume         * 0.20 +
    streak         * 0.20 +
    skipDiscipline * 0.15 +
    difficultyBonus * 0.15 +
    persistenceBonus * 0.05,
  );

  const MODEL_LABEL: Record<string, string> = {
    dkt:  'DKT',
    sakt: 'SAKT',
    bkt:  'BKT',
  };

  return {
    overall: Math.min(100, composite),
    mlPowered: true,
    modelLabel: MODEL_LABEL[mlMeta.model] ?? 'AI',
    breakdown: [
      { label: 'Accuracy',    score: Math.round(accuracy),       weight: 25, icon: '🎯' as const },
      { label: 'Volume',      score: Math.round(volume),         weight: 20, icon: '📚' as const },
      { label: 'Streak',      score: Math.round(streak),         weight: 20, icon: '🔥' as const },
      { label: 'Discipline',  score: Math.round(skipDiscipline), weight: 15, icon: '🧘' as const },
      { label: 'Difficulty',  score: Math.round(difficultyBonus), weight: 15, icon: '⚡' as const },
      ...(mlMeta.dropoutRisk >= 0.55
        ? [{ label: 'Persistence', score: persistenceBonus, weight: 5, icon: '💎' as const }]
        : []),
    ],
  };
}

function classifyFocus(score: number): { label: string; color: string; emoji: string } {
  if (score >= 85) return { label: 'Deep Focus',     color: '#10B981', emoji: '🧠' };
  if (score >= 65) return { label: 'Solid Session',  color: '#3B82F6', emoji: '💪' };
  if (score >= 40) return { label: 'Light Practice', color: '#F59E0B', emoji: '📖' };
  return               { label: 'Shallow Pass',    color: '#EF4444', emoji: '⚡' };
}

// ─── Component ────────────────────────────────────────────────

export function FocusQualityScore(props: FocusQualityScoreProps) {
  const { theme } = useTheme();
  const { overall, breakdown, mlPowered, modelLabel } = computeFocusScore(props);
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

        {/* Breakdown grid — wraps to fit 4 or 6 tiles */}
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

        {/* ML attribution footer — only shown when AI-powered */}
        {mlPowered && modelLabel && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: theme.border + '50',
          }}>
            <Ionicons name="sparkles" size={11} color={color} />
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              Quality score calibrated by{' '}
              <Typography variant="captionBold" color={color} style={{ fontSize: 10 }}>
                {modelLabel}
              </Typography>
              {' '}· Difficulty &amp; Persistence bonuses active
            </Typography>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
