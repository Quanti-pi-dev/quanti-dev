// ─── MistakePatterns ─────────────────────────────────────────
// Shows the student's top recurring mistakes with mastery %,
// classification label, and a live "Practice This Concept" CTA
// that launches a dedicated concept-level adaptive study session.
//
// Data source: ExamReadiness.weakConcepts (BKT p_mastery < 0.4)
// Navigation:  /topic-review?mode=concept_practice&conceptTag=...
//
// ML-aware ordering: concepts sorted by "most learnable first"
//   = largest mastery gap where student already has some traction
//     (p_mastery > 0.05). Pure-zero mastery concepts go last —
//     they require foundational study, not quick fixes.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

// ─── Types ────────────────────────────────────────────────────

interface WeakConcept {
  concept: string;
  tag: string;
  topicSlug: string;
  subjectId: string;
  subjectName: string;
  examId?: string;
  pMastery: number;
}

interface MistakePatternsProps {
  weakConcepts: WeakConcept[];
}

// ─── Helpers ──────────────────────────────────────────────────

function classifyMastery(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: 'Distinguished', color: '#10B981' };
  if (pct >= 60) return { label: 'Proficient',    color: '#3B82F6' };
  if (pct >= 20) return { label: 'Developing',    color: '#F59E0B' };
  return               { label: 'Emerging',      color: '#EF4444' };
}

/**
 * "Most learnable" ordering:
 *   1. Concepts with some traction (p_mastery > 0.05) — these are fixable fast.
 *      Within this group: sort by largest gap (1 − p_mastery) descending.
 *   2. Zero-traction concepts (p_mastery ≤ 0.05) — need foundational work, last.
 *      Within this group: preserve original BKT order.
 */
function sortByLearnability(concepts: WeakConcept[]): WeakConcept[] {
  const hasTraction = concepts.filter((c) => c.pMastery > 0.05);
  const noTraction  = concepts.filter((c) => c.pMastery <= 0.05);

  hasTraction.sort((a, b) => b.pMastery - a.pMastery); // largest existing mastery first = quickest win

  return [...hasTraction, ...noTraction];
}

// ─── Component ────────────────────────────────────────────────

export function MistakePatterns({ weakConcepts }: MistakePatternsProps) {
  const { theme } = useTheme();
  const router = useRouter();

  // ML-aware ordering: most learnable first
  const ordered = sortByLearnability(weakConcepts);
  const top3 = ordered.slice(0, 3);

  if (top3.length === 0) {
    return (
      <Card>
        <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.lg }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: '#10B98118',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </View>
          <Typography variant="label" color="#10B981">No Critical Mistakes</Typography>
          <Typography variant="caption" color={theme.textTertiary} align="center">
            You're not repeatedly failing any concept — keep it up!
          </Typography>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ gap: spacing.lg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: '#EF444418',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h4">Mistake Patterns</Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              Sorted by quickest to fix
            </Typography>
          </View>
          <View style={{
            paddingHorizontal: spacing.sm, paddingVertical: 3,
            borderRadius: radius.full,
            backgroundColor: '#EF444412',
          }}>
            <Typography variant="caption" color="#EF4444" style={{ fontSize: 10 }}>
              {weakConcepts.length} concept{weakConcepts.length !== 1 ? 's' : ''}
            </Typography>
          </View>
        </View>

        {/* Mistake rows */}
        {top3.map((wc, i) => {
          const masteryPct = Math.round(wc.pMastery * 100);
          const { label, color } = classifyMastery(masteryPct);
          const canNavigate = !!wc.tag;
          const isTopPick   = i === 0 && wc.pMastery > 0.05; // first learnable concept

          const handlePractice = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/topic-review',
              params: {
                mode:        'concept_practice',
                conceptTag:  wc.tag,
                conceptName: wc.concept,
                topicSlug:   wc.topicSlug,
                topicName:   wc.concept,
                subjectName: wc.subjectName,
                subjectId:   wc.subjectId,
                examId:      wc.examId ?? '',
                cardCount:   '25',
              },
            });
          };

          return (
            <Animated.View
              key={`${wc.tag}-${i}`}
              entering={FadeInDown.delay(i * 80).duration(300)}
              style={{
                backgroundColor: color + '08',
                borderRadius: radius.xl,
                padding: spacing.md,
                borderWidth: isTopPick ? 1.5 : 1,
                borderColor: isTopPick ? color + '40' : color + '20',
                gap: spacing.sm,
              }}
            >
              {/* Title row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: color + '22',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography variant="caption" color={color} style={{ fontSize: 12, fontWeight: '800' }}>
                    {i + 1}
                  </Typography>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Typography variant="label" numberOfLines={1} style={{ flex: 1 }}>
                      {wc.concept}
                    </Typography>
                    {/* "Start Here" affordance on the most learnable concept */}
                    {isTopPick && (
                      <View style={{
                        backgroundColor: '#10B98115',
                        borderRadius: radius.full,
                        paddingHorizontal: 6, paddingVertical: 2,
                        borderWidth: 1, borderColor: '#10B98125',
                      }}>
                        <Typography variant="caption" color="#10B981" style={{ fontSize: 9, fontWeight: '700' }}>
                          Start Here
                        </Typography>
                      </View>
                    )}
                  </View>
                  <Typography variant="caption" color={theme.textTertiary}>{wc.subjectName}</Typography>
                </View>
                <View style={{
                  paddingHorizontal: spacing.sm, paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: color + '18',
                }}>
                  <Typography variant="captionBold" color={color}>{label}</Typography>
                </View>
              </View>

              {/* Mastery bar */}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color={theme.textSecondary}>Mastery</Typography>
                  <Typography variant="captionBold" color={color}>{masteryPct}%</Typography>
                </View>
                <ProgressBar progress={wc.pMastery} height={5} color={color} />
              </View>

              {/* CTA */}
              <TouchableOpacity
                onPress={canNavigate ? handlePractice : undefined}
                activeOpacity={canNavigate ? 0.7 : 1}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  backgroundColor: canNavigate ? color + '15' : theme.cardAlt,
                  opacity: canNavigate ? 1 : 0.4,
                }}
              >
                <Ionicons name="flash" size={14} color={canNavigate ? color : theme.textTertiary} />
                <Typography variant="captionBold" color={canNavigate ? color : theme.textTertiary}>
                  {isTopPick ? `Practice ${wc.concept}` : 'Practice This Concept'}
                </Typography>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Card>
  );
}
