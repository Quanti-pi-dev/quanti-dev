// ─── WeeklyReportCard ────────────────────────────────────────
// A compact, shareable weekly progress summary that sits at the
// top of the Progress tab. Shows This Week vs Last Week with
// animated bar sparkline, delta chips, and a motivational headline.
// Computed entirely from the existing weekly session history.

import { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import type { UserPreferences } from '@kd/shared';

// ─── Types ───────────────────────────────────────────────────

interface SessionRecord {
  cardsStudied: number;
  correctAnswers: number;
  startedAt: string;
}

interface DayData {
  label: string;       // Mon, Tue…
  cards: number;
  isToday: boolean;
}

interface WeekStats {
  cards: number;
  accuracy: number;   // 0–100
  daysActive: number;
  sessions: number;
}

// ─── Mini bar sparkline ───────────────────────────────────────

function DayBar({
  day,
  maxCards,
  index,
  color,
}: {
  day: DayData;
  maxCards: number;
  index: number;
  color: string;
}) {
  const { theme, isDark } = useTheme();
  const fillH = useSharedValue(0);

  useMemo(() => {
    fillH.value = withDelay(
      index * 60,
      withTiming(maxCards > 0 ? day.cards / maxCards : 0, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [day.cards, maxCards]);

  const fillStyle = useAnimatedStyle(() => ({
    flex: fillH.value,
  }));

  return (
    <View style={{ alignItems: 'center', gap: spacing.xs, flex: 1 }}>
      {/* Bar */}
      <View
        style={{
          width: '100%',
          height: 48,
          borderRadius: radius.sm,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        {day.cards > 0 && (
          <Animated.View
            style={[
              fillStyle,
              {
                backgroundColor: day.isToday ? color : color + '80',
                borderRadius: radius.sm,
              },
            ]}
          />
        )}
      </View>
      {/* Label */}
      <Typography
        variant="caption"
        style={{ fontSize: 10 }}
        color={day.isToday ? color : theme.textTertiary}
      >
        {day.label}
      </Typography>
    </View>
  );
}

// ─── Delta chip ───────────────────────────────────────────────

function DeltaChip({ value, unit = '' }: { value: number; unit?: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? '#6B7280' : isPositive ? '#10B981' : '#EF4444';
  const icon = isNeutral ? 'remove' : isPositive ? 'trending-up' : 'trending-down';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: color + '18',
      }}
    >
      <Ionicons name={icon as any} size={11} color={color} />
      <Typography variant="caption" color={color} style={{ fontSize: 11 }}>
        {isPositive ? '+' : ''}{value}{unit}
      </Typography>
    </View>
  );
}

// ─── Motivational headline ────────────────────────────────────

function getHeadline(
  thisWeek: WeekStats,
  lastWeek: WeekStats,
  streak: number,
  preferences?: Pick<UserPreferences, 'examDate'> | null,
): { emoji: string; text: string } {
  const daysUntilExam = preferences?.examDate
    ? Math.ceil((new Date(preferences.examDate).getTime() - Date.now()) / 86400000)
    : null;

  if (thisWeek.daysActive === 7) return { emoji: '🔥', text: 'Perfect week — studied every day!' };
  if (thisWeek.cards === 0) return { emoji: '💤', text: 'No cards this week — let\'s change that!' };
  if (lastWeek.cards > 0 && thisWeek.cards > lastWeek.cards * 1.2)
    return { emoji: '🚀', text: `Up ${Math.round(((thisWeek.cards - lastWeek.cards) / lastWeek.cards) * 100)}% from last week!` };
  if (streak >= 7) return { emoji: '⚡', text: `${streak}-day streak — you\'re on fire!` };
  if (daysUntilExam && daysUntilExam <= 14)
    return { emoji: '🎯', text: `${daysUntilExam} days to exam — every session counts!` };
  if (thisWeek.accuracy >= 80) return { emoji: '🎯', text: `${thisWeek.accuracy}% accuracy this week — sharp!` };
  return { emoji: '📚', text: `${thisWeek.cards} cards down this week. Keep going!` };
}

// ─── Main component ───────────────────────────────────────────

interface WeeklyReportCardProps {
  sessions: SessionRecord[];
  streak: number;
  preferences?: Pick<UserPreferences, 'examDate'> | null;
  onViewDetails?: () => void;
}

export function WeeklyReportCard({
  sessions,
  streak,
  preferences,
  onViewDetails,
}: WeeklyReportCardProps) {
  const { theme, isDark } = useTheme();

  const { thisWeek, lastWeek, days, maxCards } = useMemo(() => {
    const now = new Date();
    // Start of this ISO week (Mon)
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);

    // Aggregate by date
    const dateMap = new Map<string, number>();
    let thisCards = 0, thisCorrect = 0, thisSessions = 0;
    let lastCards = 0, lastCorrect = 0;

    for (const s of sessions) {
      const d = new Date(s.startedAt);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, (dateMap.get(key) ?? 0) + s.cardsStudied);

      if (d >= monday) {
        thisCards += s.cardsStudied;
        thisCorrect += s.correctAnswers;
        thisSessions++;
      } else if (d >= lastMonday) {
        lastCards += s.cardsStudied;
        lastCorrect += s.correctAnswers;
      }
    }

    // Build 7-day bar data (Mon→Sun of this week)
    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayKey = now.toISOString().slice(0, 10);
    const days: DayData[] = DAY_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      return {
        label,
        cards: dateMap.get(key) ?? 0,
        isToday: key === todayKey,
      };
    });

    const maxCards = Math.max(...days.map(d => d.cards), 1);
    const thisWeek: WeekStats = {
      cards: thisCards,
      accuracy: thisCards > 0 ? Math.round((thisCorrect / thisCards) * 100) : 0,
      daysActive: days.filter(d => d.cards > 0).length,
      sessions: thisSessions,
    };
    const lastWeek: WeekStats = {
      cards: lastCards,
      accuracy: lastCards > 0 ? Math.round((lastCorrect / lastCards) * 100) : 0,
      daysActive: 0,
      sessions: 0,
    };

    return { thisWeek, lastWeek, days, maxCards };
  }, [sessions]);

  const headline = getHeadline(thisWeek, lastWeek, streak, preferences);
  const cardsDelta = lastWeek.cards > 0
    ? Math.round(((thisWeek.cards - lastWeek.cards) / lastWeek.cards) * 100)
    : thisWeek.cards > 0 ? 100 : 0;
  const accDelta = thisWeek.accuracy - lastWeek.accuracy;

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View
        style={{
          borderRadius: radius['2xl'],
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)',
        }}
      >
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.09)', 'rgba(16,185,129,0.05)']
            : ['rgba(99,102,241,0.06)', 'rgba(16,185,129,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing.lg, gap: spacing.md }}
        >
          {/* Header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="bar-chart-outline" size={16} color={theme.primary} />
                <Typography variant="overline" color={theme.primary}>WEEKLY REPORT</Typography>
              </View>
              <Typography variant="h4" color={theme.text}>
                {headline.emoji} {headline.text}
              </Typography>
            </View>
            {onViewDetails && (
              <TouchableOpacity
                onPress={onViewDetails}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Typography variant="caption" color={theme.primary}>Details →</Typography>
              </TouchableOpacity>
            )}
          </View>

          {/* 7-day sparkline */}
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-end' }}>
            {days.map((day, i) => (
              <DayBar
                key={day.label}
                day={day}
                maxCards={maxCards}
                index={i}
                color={theme.primary}
              />
            ))}
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {/* Cards this week */}
            <View
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                gap: spacing.xs,
              }}
            >
              <Typography variant="h3" color={theme.text} style={{ fontSize: 22, fontWeight: '800' }}>
                {thisWeek.cards}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>Cards this week</Typography>
              {lastWeek.cards > 0 && <DeltaChip value={cardsDelta} unit="%" />}
            </View>

            {/* Accuracy */}
            <View
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                gap: spacing.xs,
              }}
            >
              <Typography variant="h3" color={theme.text} style={{ fontSize: 22, fontWeight: '800' }}>
                {thisWeek.cards > 0 ? `${thisWeek.accuracy}%` : '—'}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>Accuracy</Typography>
              {thisWeek.cards > 0 && lastWeek.cards > 0 && <DeltaChip value={accDelta} unit="%" />}
            </View>

            {/* Days active */}
            <View
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                gap: spacing.xs,
              }}
            >
              <Typography variant="h3" color={theme.text} style={{ fontSize: 22, fontWeight: '800' }}>
                {thisWeek.daysActive}/7
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>Days active</Typography>
              {/* Consistency indicator */}
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {days.map((d, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: d.cards > 0
                        ? theme.primary
                        : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}
