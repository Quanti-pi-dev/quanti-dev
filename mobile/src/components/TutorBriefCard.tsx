// ─── TutorBriefCard ──────────────────────────────────────────
// Intelligence-driven insight card for the Home screen.
// Replaces the old heuristic-based StudyInsightsCard with real
// data from the Learning Intelligence Engine (BKT, IRT, SM-2).
//
// Content priority cascade:
//  1. Low exam readiness → actionable warning
//  2. High-risk topic decay → specific topic alert
//  3. Retention dip → velocity-based nudge
//  4. High readiness → celebration + momentum
//  5. Fallback → study plan insight string

import { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import type { LearningProfile, UserPreferences } from '@kd/shared';

interface TutorBriefProps {
  learningProfile: LearningProfile;
  preferences: Pick<UserPreferences, 'studyPersonality' | 'motivationType' | 'sessionPreference'> | null | undefined;
  streak: number;
}

interface BriefContent {
  icon: string;
  title: string;
  body: string;
  color: string;
  action?: { label: string; route: Href };
}

function generateBrief(
  profile: LearningProfile,
  prefs: TutorBriefProps['preferences'],
  streak: number,
): BriefContent {
  const readiness = profile.examReadiness;
  const velocity = profile.velocity;
  const highRiskTopics = profile.topicForecasts.filter(f => f.riskLevel === 'high');
  const motive = prefs?.motivationType;

  // ─── 1. Low exam readiness ─────────────────────────────
  if (readiness.overallScore < 50 && readiness.vulnerableAreas.length > 0) {
    const area = readiness.vulnerableAreas[0]!;
    const body = motive === 'competing'
      ? `You're at ${readiness.overallScore}% readiness. Top students average 78%. Focus on ${area} to close the gap.`
      : motive === 'goals'
        ? `At ${readiness.overallScore}% readiness. Focus 15 minutes on ${area} today to push past 55%.`
        : `Your readiness is at ${readiness.overallScore}%. ${area} is your biggest growth opportunity right now.`;

    return {
      icon: '🎯',
      title: 'Focus Area Identified',
      body,
      color: '#F59E0B',
      action: { label: 'Study Now', route: '/(tabs)/study' as Href },
    };
  }

  // ─── 2. Topic decay warning ────────────────────────────
  if (highRiskTopics.length > 0) {
    const topic = highRiskTopics[0]!;
    return {
      icon: '⚠️',
      title: 'Memory Decay Alert',
      body: `${topic.topicName} is predicted to drop from ${topic.currentAccuracy}% → ${topic.predictedAccuracyIn7Days}%. A ${topic.recommendedReviewCards}-card review would stabilize it.`,
      color: '#EF4444',
      action: { label: 'Review Now', route: '/review-queue' as Href },
    };
  }

  // ─── 3. Retention dip ─────────────────────────────────
  if (velocity.retentionDelta < -5) {
    return {
      icon: '📉',
      title: 'Retention Dipped',
      body: `Your retention dropped ${Math.abs(Math.round(velocity.retentionDelta))}% this week. A focused review session today would bring it back.`,
      color: '#F97316',
      action: { label: 'Review Cards', route: '/review-queue' as Href },
    };
  }

  // ─── 4. High readiness — celebrate ─────────────────────
  if (readiness.overallScore >= 75) {
    const delta = readiness.weeklyDelta;
    const body = motive === 'competing'
      ? `${readiness.overallScore}% exam readiness — you're in the top tier. ${readiness.strongAreas[0] ? `Dominating ${readiness.strongAreas[0]}.` : ''}`
      : motive === 'progress' && delta > 0
        ? `${readiness.overallScore}% readiness, up ${delta}% this week! Your consistency is paying off.`
        : `Tracking strong at ${readiness.overallScore}% readiness. ${readiness.strongAreas.length > 0 ? `${readiness.strongAreas[0]} is your strongest area.` : 'Keep the momentum!'}`;

    return {
      icon: '🌟',
      title: 'Tracking Strong',
      body,
      color: '#10B981',
    };
  }

  // ─── 5. Good with room to grow ─────────────────────────
  if (readiness.overallScore >= 50) {
    const weakArea = readiness.vulnerableAreas[0];
    const body = weakArea
      ? `${readiness.overallScore}% readiness. ${weakArea} is holding you back — a few focused sessions would make a difference.`
      : `${readiness.overallScore}% readiness and climbing. Keep your ${streak}-day rhythm going.`;

    return {
      icon: '📊',
      title: 'Tutor Check-In',
      body,
      color: '#6366F1',
      action: weakArea ? { label: 'Study Now', route: '/(tabs)/study' as Href } : undefined,
    };
  }

  // ─── 6. Fallback — study plan insight ──────────────────
  return {
    icon: '💡',
    title: 'Today\'s Insight',
    body: profile.studyPlan.insight || 'Start a study session to build your daily learning profile.',
    color: '#6366F1',
    action: { label: 'Start Studying', route: '/(tabs)/study' as Href },
  };
}

export function TutorBriefCard({ learningProfile, preferences, streak }: TutorBriefProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const brief = useMemo(
    () => generateBrief(learningProfile, preferences, streak),
    [learningProfile, preferences, streak],
  );

  return (
    <View style={{
      backgroundColor: brief.color + '12',
      borderRadius: radius['2xl'],
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: brief.color + '33',
      gap: spacing.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: brief.color + '22',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography variant="bodyLarge">{brief.icon}</Typography>
        </View>
        <Typography variant="label" color={brief.color}>{brief.title}</Typography>
      </View>

      <Typography variant="body" color={theme.textSecondary}>
        {brief.body}
      </Typography>

      {brief.action && (
        <TouchableOpacity
          onPress={() => router.push(brief.action!.route)}
          style={{
            backgroundColor: brief.color,
            borderRadius: 10,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            alignSelf: 'flex-start',
          }}
        >
          <Typography variant="label" color="#FFFFFF">{brief.action.label}</Typography>
        </TouchableOpacity>
      )}

      {/* Readiness micro-stat */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
        <Typography variant="caption" color={theme.textTertiary}>
          📊 {learningProfile.examReadiness.overallScore}% readiness
        </Typography>
        {learningProfile.examReadiness.weeklyDelta !== 0 && (
          <Typography
            variant="caption"
            color={learningProfile.examReadiness.weeklyDelta > 0 ? '#10B981' : '#EF4444'}
          >
            {learningProfile.examReadiness.weeklyDelta > 0 ? '↑' : '↓'}{Math.abs(learningProfile.examReadiness.weeklyDelta)}% this week
          </Typography>
        )}
      </View>
    </View>
  );
}
