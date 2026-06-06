// ─── MistakePatterns ─────────────────────────────────────────
// Shows the student's top 3 recurring mistakes with mastery %,
// classification label, and a "Practice This" CTA.
// Data source: ExamReadiness.weakConcepts (BKT p_mastery < 0.4)

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

// ─── Types ────────────────────────────────────────────────────

interface WeakConcept {
  concept: string;
  subjectName: string;
  pMastery: number;
}

interface MistakePatternsProps {
  weakConcepts: WeakConcept[];
}

// ─── Helpers ──────────────────────────────────────────────────

function classifyMastery(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: 'Distinguished', color: '#10B981' };
  if (pct >= 60) return { label: 'Proficient', color: '#3B82F6' };
  if (pct >= 20) return { label: 'Developing', color: '#F59E0B' };
  return { label: 'Emerging', color: '#EF4444' };
}

// ─── Component ────────────────────────────────────────────────

export function MistakePatterns({ weakConcepts }: MistakePatternsProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const top3 = weakConcepts.slice(0, 3);

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
          return (
            <Animated.View
              key={wc.concept}
              entering={FadeInDown.delay(i * 80).duration(300)}
              style={{
                backgroundColor: color + '08',
                borderRadius: radius.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: color + '20',
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
                  <Typography variant="label" numberOfLines={1}>{wc.concept}</Typography>
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
                onPress={() => router.push('/error-journal')}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  backgroundColor: color + '15',
                }}
              >
                <Ionicons name="flash" size={14} color={color} />
                <Typography variant="captionBold" color={color}>
                  Practice This Concept
                </Typography>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Card>
  );
}
