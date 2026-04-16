// ─── ChronotypeCard ──────────────────────────────────────────
// Displays the student's study chronotype with an animated hourly
// accuracy bar chart and a prominent chronotype badge.

import { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import type { ChronotypeData } from '@kd/shared';

const CHRONOTYPE_CONFIG = {
  early_bird: { emoji: '🐤', label: 'Early Bird', color: '#F59E0B' },
  day_scholar: { emoji: '☀️', label: 'Day Scholar', color: '#6366F1' },
  night_owl: { emoji: '🦉', label: 'Night Owl', color: '#8B5CF6' },
} as const;

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

interface ChronotypeCardProps {
  data: ChronotypeData;
}

export function ChronotypeCard({ data }: ChronotypeCardProps) {
  const { theme } = useTheme();
  const cfg = CHRONOTYPE_CONFIG[data.chronotype];

  // Build 24-hour bars, but only show hours with data + some context
  const chartBars = useMemo(() => {
    const byHour = new Map(data.hourlyAccuracy.map((h) => [h.hour, h]));
    const bars: { hour: number; accuracy: number; sessions: number; isPeak: boolean }[] = [];

    // Show hours 5-23, 0-4  for a natural day cycle
    for (let i = 5; i < 24; i++) {
      const d = byHour.get(i);
      bars.push({
        hour: i,
        accuracy: d?.accuracy ?? 0,
        sessions: d?.sessionCount ?? 0,
        isPeak: i === data.peakHour,
      });
    }
    for (let i = 0; i < 5; i++) {
      const d = byHour.get(i);
      bars.push({
        hour: i,
        accuracy: d?.accuracy ?? 0,
        sessions: d?.sessionCount ?? 0,
        isPeak: i === data.peakHour,
      });
    }

    return bars;
  }, [data]);

  const maxAcc = Math.max(...chartBars.map((b) => b.accuracy), 1);

  // Generate insight text
  const peakRange = `${formatHour(data.peakHour)} – ${formatHour((data.peakHour + 3) % 24)}`;
  const insightText = data.peakAccuracy > 0
    ? `You score ${Math.round(data.peakAccuracy)}% accuracy between ${peakRange}. Schedule your hardest topics around that window for maximum retention.`
    : 'Study more sessions at different times to discover your peak performance window.';

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ gap: spacing.md }}>
          {/* Header with chronotype badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4">Study Chronotype</Typography>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor: cfg.color + '18',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
              }}
            >
              <Typography variant="bodyLarge" style={{ fontSize: 18 }}>
                {cfg.emoji}
              </Typography>
              <Typography variant="label" color={cfg.color}>
                {cfg.label}
              </Typography>
            </View>
          </View>

          {/* Hourly accuracy mini bar chart */}
          <View style={{ gap: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary}>
              Accuracy by hour of day
            </Typography>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 1 }}>
              {chartBars.map((bar) => {
                const heightPct = bar.accuracy > 0 ? Math.max(4, (bar.accuracy / maxAcc) * 60) : 2;
                const barColor = bar.isPeak
                  ? cfg.color
                  : bar.sessions > 0
                    ? theme.primary + '55'
                    : theme.border;

                return (
                  <View key={bar.hour} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                    <View
                      style={{
                        width: '100%',
                        height: heightPct,
                        backgroundColor: barColor,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                );
              })}
            </View>
            {/* Time labels — show every 4 hours */}
            <View style={{ flexDirection: 'row' }}>
              {chartBars.map((bar, i) =>
                i % 4 === 0 ? (
                  <Typography
                    key={bar.hour}
                    variant="caption"
                    color={theme.textTertiary}
                    style={{ flex: 4, fontSize: 8, textAlign: 'center' }}
                  >
                    {formatHour(bar.hour)}
                  </Typography>
                ) : null,
              )}
            </View>
          </View>

          {/* Peak stats */}
          {data.peakAccuracy > 0 && (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: cfg.color + '12', borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' }}>
                <Typography variant="h4" color={cfg.color}>
                  {formatHour(data.peakHour)}
                </Typography>
                <Typography variant="caption" color={theme.textTertiary}>
                  Peak Hour
                </Typography>
              </View>
              <View style={{ flex: 1, backgroundColor: cfg.color + '12', borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' }}>
                <Typography variant="h4" color={cfg.color}>
                  {Math.round(data.peakAccuracy)}%
                </Typography>
                <Typography variant="caption" color={theme.textTertiary}>
                  Peak Accuracy
                </Typography>
              </View>
            </View>
          )}
        </View>
      </Card>

      {/* Insight tip */}
      <InsightCard
        icon={cfg.emoji}
        title={`You're a ${cfg.label}`}
        body={insightText}
        accentColor={cfg.color}
        delay={200}
      />
    </View>
  );
}
