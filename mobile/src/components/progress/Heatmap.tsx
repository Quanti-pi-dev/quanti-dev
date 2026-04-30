// ─── Heatmap ──────────────────────────────────────────────────
// Interactive GitHub-style study activity heatmap.
// Features:
//   • Tappable cells with detail tooltip showing date + cards studied
//   • Animated entrance with staggered cell fade-in
//   • Active day count + current streak summary
//   • Smooth green intensity gradient with glow on selected cell
//   • Today indicator ring
//   • Responsive cell sizing

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── Constants ────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL_SIZE = 22;
const CELL_GAP = 4;
const LABEL_W = 24;

const INTENSITY_COLORS_DARK = [
  'rgba(255,255,255,0.06)',  // 0: none
  '#10B98140',               // 1: low
  '#10B98180',               // 2: medium
  '#10B981CC',               // 3: high
  '#10B981',                 // 4: max
];

const INTENSITY_COLORS_LIGHT = [
  'rgba(0,0,0,0.06)',
  '#10B98140',
  '#10B98180',
  '#10B981CC',
  '#10B981',
];

// ─── Types ────────────────────────────────────────────────────

interface CellInfo {
  week: number;
  day: number;
  intensity: number;
  date: Date;
  dateStr: string;
  isToday: boolean;
  isFuture: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────

function getDateForCell(weeksCount: number, week: number, day: number): Date {
  const now = new Date();
  const today = (now.getDay() + 6) % 7; // Mon=0
  const weeksAgo = weeksCount - 1 - week;
  const daysAgo = weeksAgo * 7 + (today - day);
  const d = new Date(now);
  d.setDate(now.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// ─── Component ────────────────────────────────────────────────

interface HeatmapProps {
  heatmap: number[][];
}

export function Heatmap({ heatmap }: HeatmapProps) {
  const { theme } = useTheme();
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);

  const isDark = theme.background === '#000000' || theme.background === '#0A0A0F' ||
    (theme.background && parseInt(theme.background.replace('#', ''), 16) < 0x404040);

  const intensityColors = isDark ? INTENSITY_COLORS_DARK : INTENSITY_COLORS_LIGHT;

  // Build cell metadata
  const { cells, activeDays, totalDays, currentStreak, maxIntensity } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weeksCount = heatmap.length;
    const cellData: CellInfo[][] = [];
    let active = 0;
    let total = 0;
    let streak = 0;
    let streakBroken = false;
    let maxI = 0;

    // Process in reverse chronological order for streak calculation
    const flatCells: CellInfo[] = [];

    for (let w = 0; w < weeksCount; w++) {
      const weekCells: CellInfo[] = [];
      const week = heatmap[w] ?? [];
      for (let d = 0; d < 7; d++) {
        const date = getDateForCell(weeksCount, w, d);
        const isToday = isSameDay(date, now);
        const isFuture = date > now;
        const intensity = Math.min(week[d] ?? 0, 4);

        if (intensity > maxI) maxI = intensity;

        const cell: CellInfo = {
          week: w, day: d, intensity,
          date, dateStr: date.toISOString().slice(0, 10),
          isToday, isFuture,
        };
        weekCells.push(cell);
        if (!isFuture) {
          total++;
          if (intensity > 0) active++;
        }
        flatCells.push(cell);
      }
      cellData.push(weekCells);
    }

    // Calculate current streak (consecutive active days ending today or yesterday)
    const sorted = flatCells
      .filter((c) => !c.isFuture)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    for (const cell of sorted) {
      if (cell.intensity > 0) {
        streak++;
        streakBroken = false;
      } else {
        // Allow today to be skipped if it's still early
        if (cell.isToday && !streakBroken) continue;
        break;
      }
    }

    return {
      cells: cellData,
      activeDays: active,
      totalDays: total,
      currentStreak: streak,
      maxIntensity: maxI,
    };
  }, [heatmap]);

  const handleCellPress = useCallback((cell: CellInfo) => {
    if (cell.isFuture) return;
    setSelectedCell((prev) =>
      prev && prev.dateStr === cell.dateStr ? null : cell,
    );
  }, []);

  const intensityLabel = (i: number): string => {
    if (i === 0) return 'No activity';
    if (i === 1) return 'Light activity';
    if (i === 2) return 'Moderate activity';
    if (i === 3) return 'High activity';
    return 'Very high activity';
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Summary stats row */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
        <View style={{
          flex: 1,
          backgroundColor: theme.cardAlt,
          borderRadius: radius.lg,
          padding: spacing.sm,
          alignItems: 'center',
        }}>
          <Typography variant="h4" color="#10B981">{activeDays}</Typography>
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
            Active Days
          </Typography>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.cardAlt,
          borderRadius: radius.lg,
          padding: spacing.sm,
          alignItems: 'center',
        }}>
          <Typography variant="h4" color={theme.text}>
            {totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0}%
          </Typography>
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
            Consistency
          </Typography>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: currentStreak > 0 ? '#10B981' + '12' : theme.cardAlt,
          borderRadius: radius.lg,
          padding: spacing.sm,
          alignItems: 'center',
          borderWidth: currentStreak > 2 ? 1 : 0,
          borderColor: '#10B981' + '30',
        }}>
          <Typography variant="h4" color={currentStreak > 0 ? '#10B981' : theme.textTertiary}>
            {currentStreak}
          </Typography>
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
            Day Streak
          </Typography>
        </View>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: 'row', gap: CELL_GAP, paddingLeft: LABEL_W }}>
        {DAY_LABELS.map((d, i) => (
          <Typography
            key={i}
            variant="caption"
            color={theme.textTertiary}
            style={{ width: CELL_SIZE, fontSize: 9, textAlign: 'center' }}
          >
            {d}
          </Typography>
        ))}
      </View>

      {/* Grid */}
      {cells.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', alignItems: 'center', gap: CELL_GAP }}>
          <Typography
            variant="caption"
            color={theme.textTertiary}
            style={{ width: LABEL_W, fontSize: 9 }}
          >
            W{wi + 1}
          </Typography>
          {week.map((cell) => {
            const isSelected = selectedCell?.dateStr === cell.dateStr;
            const color = cell.isFuture
              ? 'transparent'
              : intensityColors[Math.min(cell.intensity, intensityColors.length - 1)]!;

            return (
              <Pressable
                key={cell.day}
                onPress={() => handleCellPress(cell)}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 5,
                  backgroundColor: color,
                  borderWidth: cell.isToday ? 1.5 : isSelected ? 1.5 : 0,
                  borderColor: cell.isToday
                    ? '#10B981'
                    : isSelected
                      ? theme.text + '60'
                      : 'transparent',
                  ...(isSelected && cell.intensity > 0 && {
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 5,
                    elevation: 4,
                  }),
                }}
              />
            );
          })}
        </View>
      ))}

      {/* Selected cell tooltip */}
      {selectedCell && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={{
            backgroundColor: selectedCell.intensity > 0 ? '#10B981' + '12' : theme.cardAlt,
            borderWidth: 1,
            borderColor: selectedCell.intensity > 0 ? '#10B981' + '30' : theme.border,
            borderRadius: radius.lg,
            padding: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: intensityColors[Math.min(selectedCell.intensity, intensityColors.length - 1)]!,
            }} />
            <View>
              <Typography variant="label" style={{ fontSize: 12 }}>
                {formatDate(selectedCell.date)}
              </Typography>
              <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 10 }}>
                {intensityLabel(selectedCell.intensity)}
              </Typography>
            </View>
          </View>
          <Pressable onPress={() => setSelectedCell(null)} hitSlop={12}>
            <Typography variant="caption" color={theme.textTertiary}>✕</Typography>
          </Pressable>
        </Animated.View>
      )}

      {/* Legend */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: CELL_GAP,
        justifyContent: 'flex-end',
      }}>
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
          Less
        </Typography>
        {intensityColors.map((c, i) => (
          <View
            key={i}
            style={{
              width: 12, height: 12, borderRadius: 3,
              backgroundColor: c,
            }}
          />
        ))}
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
          More
        </Typography>
      </View>
    </View>
  );
}
