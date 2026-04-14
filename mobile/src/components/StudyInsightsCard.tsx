// ─── StudyInsightsCard ────────────────────────────────────────
// Data-driven tips card. Shows the single most relevant insight
// based on the user's current stats. Zero API calls — pure frontend logic.

import { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';

interface InsightData {
  streak: number;
  freezes: number;
  accuracy: number | null;  // 0-100 or null
  studiedToday: boolean;
  weakestSubject?: string;
}

interface Insight {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; route: string };
  priority: number;
  color: string;
}

function generateInsights(data: InsightData): Insight[] {
  const insights: Insight[] = [];

  // No study today — highest priority if streak is active
  if (!data.studiedToday && data.streak > 0) {
    insights.push({
      icon: '⏰',
      title: 'Keep your streak alive!',
      body: `You haven't studied today yet. Complete a session to maintain your ${data.streak}-day streak.`,
      action: { label: 'Study Now', route: '/(tabs)/study' },
      priority: 100,
      color: '#EF4444',
    });
  }

  // High streak, no freezes — buy protection
  if (data.streak >= 7 && data.freezes === 0) {
    insights.push({
      icon: '🛡️',
      title: 'Protect your streak!',
      body: `Your ${data.streak}-day streak has no protection. Buy a Streak Freeze to be safe.`,
      action: { label: 'Get Freeze', route: '/shop' },
      priority: 90,
      color: '#F59E0B',
    });
  }

  // Low accuracy — improvement tip
  if (data.accuracy != null && data.accuracy > 0 && data.accuracy < 60) {
    insights.push({
      icon: '📚',
      title: 'Room to improve',
      body: data.weakestSubject
        ? `Your accuracy is ${data.accuracy}%. Focus on ${data.weakestSubject} — try reviewing flashcards at a slower pace.`
        : `Your accuracy is ${data.accuracy}%. Take your time with each question for better retention.`,
      priority: 70,
      color: '#6366F1',
    });
  }

  // Good streak — celebrate
  if (data.streak >= 14) {
    insights.push({
      icon: '🌟',
      title: 'Incredible consistency!',
      body: `${data.streak} days in a row! You're in the top tier of dedicated learners.`,
      priority: 40,
      color: '#10B981',
    });
  } else if (data.streak >= 3) {
    insights.push({
      icon: '💪',
      title: 'Building momentum',
      body: `${data.streak} days strong! Keep going — milestones at 7 and 30 days unlock bonus coins.`,
      priority: 30,
      color: '#10B981',
    });
  }

  // High accuracy — praise
  if (data.accuracy != null && data.accuracy >= 85) {
    insights.push({
      icon: '🎯',
      title: 'Sharp recall!',
      body: `${data.accuracy}% accuracy — your retention is excellent. Consider leveling up to a harder difficulty.`,
      priority: 35,
      color: '#10B981',
    });
  }

  // No study today and no streak — gentle nudge
  if (!data.studiedToday && data.streak === 0) {
    insights.push({
      icon: '🚀',
      title: 'Start a streak today',
      body: 'Complete your first study session to begin earning streak bonuses!',
      action: { label: 'Start Studying', route: '/(tabs)/study' },
      priority: 50,
      color: '#6366F1',
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

export function StudyInsightsCard({ data }: { data: InsightData }) {
  const { theme } = useTheme();
  const router = useRouter();

  const insights = useMemo(() => generateInsights(data), [data]);
  const top = insights[0];
  if (!top) return null;

  return (
    <View style={{
      backgroundColor: top.color + '12',
      borderRadius: radius['2xl'],
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: top.color + '33',
      gap: spacing.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: top.color + '22',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography variant="bodyLarge">{top.icon}</Typography>
        </View>
        <Typography variant="label" color={top.color}>{top.title}</Typography>
      </View>

      <Typography variant="body" color={theme.textSecondary}>
        {top.body}
      </Typography>

      {top.action && (
        <TouchableOpacity
          onPress={() => router.push(top.action!.route as never)}
          style={{
            backgroundColor: top.color,
            borderRadius: 10,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            alignSelf: 'flex-start',
          }}
        >
          <Typography variant="label" color="#FFFFFF">{top.action.label}</Typography>
        </TouchableOpacity>
      )}

      {/* Secondary insight preview */}
      {insights.length > 1 && (
        <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
          💡 {insights[1]!.title}
        </Typography>
      )}
    </View>
  );
}
