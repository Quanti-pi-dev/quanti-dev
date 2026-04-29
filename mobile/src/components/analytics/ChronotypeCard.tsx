import { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import type { ChronotypeData } from '@kd/shared';

const CHRONOTYPE_CONFIG = {
  early_bird: { emoji: '🌅', label: 'Early Bird', color: '#F59E0B', grad: ['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.02)'] as [string, string] },
  day_scholar: { emoji: '☀️', label: 'Day Scholar', color: '#0EA5E9', grad: ['rgba(14,165,233,0.2)', 'rgba(14,165,233,0.02)'] as [string, string] },
  night_owl: { emoji: '🦉', label: 'Night Owl', color: '#8B5CF6', grad: ['rgba(139,92,246,0.2)', 'rgba(139,92,246,0.02)'] as [string, string] },
} as const;

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

interface ChronotypeCardProps {
  data: ChronotypeData;
}

// Animated bar component for the chart
function AnimatedBar({ heightPct, isPeak, baseColor, delay }: { heightPct: number; isPeak: boolean; baseColor: string; delay: number }) {
  const { theme } = useTheme();
  const height = useSharedValue(4);
  
  useMemo(() => {
    if (heightPct > 6) {
      height.value = withDelay(delay, withSpring(heightPct, { damping: 14, stiffness: 120 }));
    } else {
      height.value = heightPct;
    }
  }, [heightPct, delay]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const color = isPeak ? baseColor : baseColor + '33';

  return (
    <Animated.View
      style={[
        {
          width: '80%',
          backgroundColor: color,
          borderRadius: 4,
          alignSelf: 'center',
          ...(isPeak && { shadowColor: baseColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4 })
        },
        animStyle,
      ]}
    />
  );
}

export function ChronotypeCard({ data }: ChronotypeCardProps) {
  const { theme } = useTheme();
  const cfg = CHRONOTYPE_CONFIG[data.chronotype] || CHRONOTYPE_CONFIG.day_scholar;

  // Build 24-hour bars, but only show hours with data + some context
  const chartBars = useMemo(() => {
    const byHour = new Map(data.hourlyAccuracy.map((h) => [h.hour, h]));
    const bars: { hour: number; accuracy: number; sessions: number; isPeak: boolean }[] = [];

    // Show hours 5-23, 0-4 for a natural day cycle
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

  const maxSessions = Math.max(...chartBars.map((b) => b.sessions), 1);

  // Generate insight text
  const peakRange = `${formatHour(data.peakHour)} – ${formatHour((data.peakHour + 3) % 24)}`;
  const insightText = data.peakAccuracy > 0
    ? `You score ${Math.round(data.peakAccuracy)}% accuracy between ${peakRange}. Schedule your hardest topics around that window for maximum retention.`
    : 'Study more sessions at different times to discover your peak performance window.';

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {/* HERO GRADIENT HEADER */}
      <LinearGradient
        colors={cfg.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.xl, position: 'relative', overflow: 'hidden' }}
      >
        {/* Huge Background Emoji */}
        <Typography
          style={{
            position: 'absolute',
            right: -10,
            top: -20,
            fontSize: 110,
            opacity: 0.15,
            zIndex: -1,
          }}
        >
          {cfg.emoji}
        </Typography>

        <Typography variant="captionBold" color={cfg.color} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          Study Chronotype
        </Typography>
        <Typography variant="h2" color={theme.text} style={{ marginTop: spacing.xs }}>
          {cfg.label} {cfg.emoji}
        </Typography>
        <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.sm, maxWidth: '85%' }}>
          {insightText}
        </Typography>
      </LinearGradient>

      {/* CONTENT BODY */}
      <View style={{ padding: spacing.xl, gap: spacing.xl }}>
        {/* Animated Bar Chart */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Typography variant="label" color={theme.textSecondary}>Activity Cycle</Typography>
            <Typography variant="captionBold" color={cfg.color}>Peak: {formatHour(data.peakHour)}</Typography>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4, borderBottomWidth: 1, borderBottomColor: theme.border + '40', paddingBottom: 4 }}>
            {chartBars.map((bar, index) => {
              const heightPct = bar.sessions > 0 ? Math.max(12, (bar.sessions / maxSessions) * 96) : 6;
              return (
                <View key={bar.hour} style={{ flex: 1, alignItems: 'center' }}>
                  <AnimatedBar heightPct={heightPct} isPeak={bar.isPeak} baseColor={cfg.color} delay={index * 20} />
                </View>
              );
            })}
          </View>
          
          {/* Time Labels */}
          <View style={{ flexDirection: 'row' }}>
            {chartBars.map((bar, i) =>
              i % 4 === 0 ? (
                <Typography key={bar.hour} variant="caption" color={theme.textTertiary} style={{ flex: 4, fontSize: 9, textAlign: 'center' }}>
                  {formatHour(bar.hour)}
                </Typography>
              ) : null
            )}
          </View>
        </View>

        {/* Peak Stats Callouts */}
        {data.peakAccuracy > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1, backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.border, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center' }}>
              <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.xs }}>
                Peak Hour
              </Typography>
              <Typography variant="h3" color={cfg.color}>
                {formatHour(data.peakHour)}
              </Typography>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.border, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center' }}>
              <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.xs }}>
                Max Accuracy
              </Typography>
              <Typography variant="h3" color={cfg.color}>
                {Math.round(data.peakAccuracy)}%
              </Typography>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
