// ─── NextMilestoneCard ───────────────────────────────────────
// Shows the next achievable readiness milestone on the Progress
// screen, creating forward momentum. Milestones: 50, 60, 75, 85, 95.

import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { ProgressBar } from './ui/ProgressBar';
import type { ExamReadiness, SubjectMemoryState } from '@kd/shared';

interface Props {
  examReadiness: ExamReadiness;
  knowledgeHealth: SubjectMemoryState[];
}

const MILESTONES = [50, 60, 75, 85, 95];

function getMilestoneEmoji(target: number): string {
  if (target >= 95) return '🏆';
  if (target >= 85) return '🌟';
  if (target >= 75) return '🎯';
  if (target >= 60) return '📈';
  return '🚀';
}

function getActionTip(
  current: number,
  target: number,
  weakest: SubjectMemoryState | undefined,
): string {
  const gap = target - current;
  if (weakest && weakest.conceptMastery < 50) {
    return `Focus on ${weakest.subjectName} to close the ${gap}% gap.`;
  }
  if (gap <= 3) {
    return 'Almost there — one focused session could push you past this!';
  }
  if (gap <= 10) {
    return 'A few targeted reviews this week will get you there.';
  }
  return 'Consistent daily study will close this gap steadily.';
}

export function NextMilestoneCard({ examReadiness, knowledgeHealth }: Props) {
  const { theme } = useTheme();
  const current = examReadiness.overallScore;

  // Find next milestone above current score
  const target = MILESTONES.find(m => m > current);

  // If they've passed all milestones, show completion
  if (!target) {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(350)}>
        <View style={{
          backgroundColor: '#10B98112',
          borderRadius: radius['2xl'],
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: '#10B98133',
          gap: spacing.sm,
          alignItems: 'center',
        }}>
          <Typography style={{ fontSize: 32 }}>🏆</Typography>
          <Typography variant="label" color="#10B981">All Milestones Reached!</Typography>
          <Typography variant="body" color={theme.textSecondary} style={{ textAlign: 'center' }}>
            You're at {current}% readiness — in the elite zone. Keep reinforcing to maintain it.
          </Typography>
        </View>
      </Animated.View>
    );
  }

  const emoji = getMilestoneEmoji(target);
  const progress = Math.min(1, Math.max(0, current / target));
  const gap = target - current;

  // Find weakest subject that has actually been studied
  const sorted = [...knowledgeHealth]
    .filter(s => s.studiedTopics > 0)  // exclude entirely untouched subjects
    .sort((a, b) => (a.conceptMastery || a.retentionEstimate) - (b.conceptMastery || b.retentionEstimate));
  const weakest = sorted[0];
  const tip = getActionTip(current, target, weakest);

  const milestoneColor = gap <= 5 ? '#10B981' : gap <= 15 ? '#F59E0B' : '#6366F1';

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(350)}>
      <View style={{
        backgroundColor: theme.card,
        borderRadius: radius['2xl'],
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: milestoneColor + '33',
        gap: spacing.md,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: milestoneColor + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography style={{ fontSize: 18 }}>{emoji}</Typography>
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="label" color={milestoneColor}>Next Milestone</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Reach {target}% Exam Readiness
            </Typography>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Typography variant="captionBold" color={milestoneColor}>
              +{gap}% to go
            </Typography>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ gap: 4 }}>
          <ProgressBar progress={progress} height={8} color={milestoneColor} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              {current}%
            </Typography>
            <Typography variant="caption" color={milestoneColor} style={{ fontSize: 10 }}>
              {target}%
            </Typography>
          </View>
        </View>

        {/* Actionable tip */}
        <Typography variant="bodySmall" color={theme.textSecondary} style={{ lineHeight: 18 }}>
          {tip}
        </Typography>
      </View>
    </Animated.View>
  );
}
