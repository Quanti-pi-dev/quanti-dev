// ─── Progress / Analytics Screen ─────────────────────────────
// Phase 1 Purge: Stripped to honest, actionable metrics only.
// KEPT: Study Plan, Exam Readiness, Topic Mastery Sunburst,
//       Weak Concepts, Error Journal, Review Queue
// PURGED: Knowledge Health Map, Learning Velocity, Weekly Report,
//         4-Stat Grid, Accuracy Trend, Cards Studied, Heatmap,
//         Chronotype, Speed vs Accuracy, Subject Radar, AI Insights

import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';

import { TodaysStudyPlan } from '../../src/components/analytics/TodaysStudyPlan';
import { ExamReadinessScore } from '../../src/components/analytics/ExamReadinessScore';
import { MasterySunburstChart } from '../../src/components/analytics/TopicSunburstChart';
import { MistakePatterns } from '../../src/components/analytics/MistakePatterns';
import { MemoryForecast } from '../../src/components/analytics/MemoryForecast';

import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useAdvancedInsights } from '../../src/hooks/useProgress';
import { useAuth } from '../../src/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useLearningProfile } from '../../src/hooks/useLearningProfile';
import { getPersonalityEmoji } from '../../src/utils/tutor-voice';
import { NextMilestoneCard } from '../../src/components/NextMilestoneCard';
import { NextMilestoneSkeleton } from '../../src/components/TutorSkeletons';

// ─── Screen ──────────────────────────────────────────────────

export default function ProgressScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { canUseFeature } = useSubscriptionGate();
  const hasAdvancedAnalytics = canUseFeature('advanced_analytics');

  // ── Data hooks ──────────────────────────────────────────────
  const { preferences } = useAuth();
  const { data: advancedData } = useAdvancedInsights(hasAdvancedAnalytics);
  const { data: learningProfile, isLoading: isLPLoading } = useLearningProfile();

  // ── Pull-to-refresh ──────────────────────────────────────
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['progress'] }),
      queryClient.invalidateQueries({ queryKey: ['gamification'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Typography variant="h3">Your Learning Profile</Typography>

        {/* ── Tutor Narrative — personalised progress summary ── */}
        {learningProfile && (() => {
          const r = learningProfile.examReadiness;
          const health = learningProfile.knowledgeHealth;
          // Only include subjects the student has actually started
          const studiedSubjects = health.filter(s => s.studiedTopics > 0);
          const sorted = [...studiedSubjects].sort(
            (a, b) => (b.conceptMastery || b.retentionEstimate) - (a.conceptMastery || a.retentionEstimate)
          );
          const strongest = sorted[0];
          const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
          const emoji = getPersonalityEmoji(preferences?.studyPersonality);
          const personality = preferences?.studyPersonality;
          const coverage = `${r.studiedTopics} of ${r.totalTopicsInExam}`;

          const narrative = personality
            ? `You're a ${personality} ${emoji} who's covered ${coverage} topics. `
            : `You've covered ${coverage} topics so far. `;

          // Use whichever score is meaningful (BKT mastery if available, otherwise SM-2 retention)
          const strongestScore = strongest
            ? (strongest.conceptMastery || strongest.retentionEstimate)
            : 0;
          const strengthLine = strongest && strongestScore > 0
            ? `Your strongest area is ${strongest.subjectName} (${strongestScore}% mastery). `
            : '';

          const weakestScore = weakest
            ? (weakest.conceptMastery || weakest.retentionEstimate)
            : 0;
          const weakLine = weakest && weakestScore < 50
            ? `${weakest.subjectName} (${weakestScore}%) needs the most attention. `
            : '';

          const pacing = r.daysToTargetReadiness > 0
            ? `At your current pace, you'll hit 85% readiness in ~${r.daysToTargetReadiness} days.`
            : r.overallScore >= 85
              ? 'You\'re at target readiness — keep reinforcing!'
              : studiedSubjects.length === 0
                ? 'Start your first study session to build your learning profile!'
                : '';

          return (
            <View style={{
              backgroundColor: theme.cardAlt,
              borderRadius: radius['2xl'],
              padding: spacing.lg,
              gap: spacing.xs,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
              <Typography variant="body" color={theme.textSecondary} style={{ lineHeight: 20 }}>
                {narrative}{strengthLine}{weakLine}{pacing}
              </Typography>
            </View>
          );
        })()}

        {/* ── Today's Study Plan (Hero) ── */}
        {learningProfile?.studyPlan && (
          <TodaysStudyPlan
            plan={learningProfile.studyPlan}
            chronotypePeakHour={advancedData?.chronotype?.peakHour}
          />
        )}

        {/* ── Exam Readiness Score (KEPT — CEO decision) ── */}
        {learningProfile?.examReadiness && (
          <ExamReadinessScore data={learningProfile.examReadiness} />
        )}

        {/* ── Subject Mastery Sunburst (rewired to BKT mastery — Phase 2) ── */}
        <MasterySunburstChart data={learningProfile?.knowledgeHealth ?? []} />

        {/* ── Mistake Patterns (replaces inline weak concepts) ── */}
        {learningProfile && (
          <MistakePatterns weakConcepts={learningProfile.examReadiness.weakConcepts} />
        )}

        {/* ── Memory Decay Forecast ── */}
        {learningProfile && learningProfile.topicForecasts.length > 0 && (
          <MemoryForecast forecasts={learningProfile.topicForecasts} />
        )}

        {/* ── Next Milestone Card ── */}
        {isLPLoading ? (
          <NextMilestoneSkeleton />
        ) : learningProfile ? (
          <NextMilestoneCard
            examReadiness={learningProfile.examReadiness}
            knowledgeHealth={learningProfile.knowledgeHealth}
          />
        ) : null}

        {/* ── Error Journal Quick Link ── */}
        <TouchableOpacity
          onPress={() => router.push('/error-journal')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: '#EF444412',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="journal-outline" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="label">Error Journal</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Review mistakes and learn from them
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        {/* ── Review Queue Quick Link ── */}
        <TouchableOpacity
          onPress={() => router.push('/review-queue')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: '#6366F112',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="refresh-circle-outline" size={20} color="#6366F1" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="label">Review Queue</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Spaced repetition cards due for review
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>

      </ScrollView>
    </ScreenWrapper>
  );
}
