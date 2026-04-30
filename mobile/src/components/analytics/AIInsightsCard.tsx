// ─── AIInsightsCard ──────────────────────────────────────────
// Premium Gemini-powered insights card for the Progress screen.
// Shows: AI narrative summary + actionable recommendations + heuristic topic data.
// Gated behind `mastery_radar` subscription feature.

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { useInsights } from '../../hooks/useAI';

interface AIInsightsCardProps {
  enabled?: boolean;
}

export function AIInsightsCard({ enabled = true }: AIInsightsCardProps) {
  const { theme } = useTheme();
  const { data, isLoading, isError } = useInsights(enabled);

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <ActivityIndicator size="small" color="#6366F1" />
        <View>
          <Typography variant="label" color={theme.textSecondary}>
            Analysing your study patterns…
          </Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            Gemini is reviewing your data
          </Typography>
        </View>
      </View>
    );
  }

  // ── No data / error ────────────────────────────────────────
  if (isError || !data) return null;

  // ── No AI summary yet (< 3 sessions) ──────────────────────
  if (!data.aiSummary && data.aiRecommendations.length === 0) {
    return (
      <View
        style={{
          backgroundColor: '#6366F108',
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: '#6366F130',
          padding: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: '#6366F118',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="sparkles-outline" size={20} color="#6366F1" />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="label" color="#6366F1">
            AI Insights Unlocked
          </Typography>
          <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: 2 }}>
            Complete 3+ study sessions to activate your Gemini-powered learning profile.
          </Typography>
        </View>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
        }}
      >
        {/* ── Header gradient ────────────────────────────── */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, position: 'relative', overflow: 'hidden' }}
        >
          {/* Background glyph */}
          <Typography
            style={{
              position: 'absolute', right: -8, top: -16,
              fontSize: 90, opacity: 0.12,
            }}
          >
            ✨
          </Typography>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="sparkles" size={14} color="rgba(255,255,255,0.9)" />
            <Typography variant="captionBold" color="rgba(255,255,255,0.9)" style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 10 }}>
              Gemini Insights
            </Typography>
          </View>

          {data.aiSummary && (
            <Typography variant="body" color="#FFFFFF" style={{ lineHeight: 22, maxWidth: '90%' }}>
              {data.aiSummary}
            </Typography>
          )}

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md }}>
            <View>
              <Typography variant="h3" color="#FFFFFF">
                {Math.round(data.retentionRate)}%
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.7)">
                Retention
              </Typography>
            </View>
            {data.optimalStudyTime !== 'Not enough data yet' && (
              <View>
                <Typography variant="label" color="#FFFFFF" style={{ fontSize: 13 }}>
                  {data.optimalStudyTime}
                </Typography>
                <Typography variant="caption" color="rgba(255,255,255,0.7)">
                  Peak window
                </Typography>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── AI Recommendations ────────────────────────── */}
        {data.aiRecommendations.length > 0 && (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Typography variant="label" color={theme.textSecondary} style={{ marginBottom: spacing.xs }}>
              Personalised Action Plan
            </Typography>
            {data.aiRecommendations.map((tip, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.sm,
                  backgroundColor: '#6366F108',
                  borderRadius: radius.lg,
                  padding: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: '#6366F122',
                    alignItems: 'center', justifyContent: 'center',
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  <Typography style={{ fontSize: 11, color: '#6366F1', fontWeight: '700' }}>
                    {i + 1}
                  </Typography>
                </View>
                <Typography variant="bodySmall" color={theme.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
                  {tip}
                </Typography>
              </View>
            ))}
          </View>
        )}

        {/* ── Weak / Strong topics ──────────────────────── */}
        {(data.weakTopics.length > 0 || data.strongTopics.length > 0) && (
          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            {data.weakTopics.length > 0 && (
              <View style={{ flex: 1, padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                  <Typography variant="caption" color={theme.textTertiary}>Needs Work</Typography>
                </View>
                {data.weakTopics.slice(0, 3).map((t) => (
                  <Typography key={t} variant="caption" color="#EF4444" numberOfLines={1}>
                    {t}
                  </Typography>
                ))}
              </View>
            )}
            {data.weakTopics.length > 0 && data.strongTopics.length > 0 && (
              <View style={{ width: 1, backgroundColor: theme.border }} />
            )}
            {data.strongTopics.length > 0 && (
              <View style={{ flex: 1, padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                  <Typography variant="caption" color={theme.textTertiary}>Strengths</Typography>
                </View>
                {data.strongTopics.slice(0, 3).map((t) => (
                  <Typography key={t} variant="caption" color="#10B981" numberOfLines={1}>
                    {t}
                  </Typography>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Footer: powered by ───────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            paddingTop: spacing.xs,
            borderTopWidth: (data.weakTopics.length > 0 || data.strongTopics.length > 0) ? 0 : 1,
            borderTopColor: theme.border,
          }}
        >
          <Ionicons name="logo-google" size={10} color={theme.textTertiary} />
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
            Powered by Gemini
          </Typography>
        </View>
      </View>
    </Animated.View>
  );
}
