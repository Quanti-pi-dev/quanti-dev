// ─── IconPickerGrid ──────────────────────────────────────────
// Visual icon picker for admin subject CRUD.
// Shows a searchable grid of curated Ionicons with selection state.

import { useState, useMemo } from 'react';
import { View, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import {
  SUBJECT_ICON_OPTIONS,
  DEFAULT_SUBJECT_ICON,
  type IoniconName,
} from '../../constants/subject-icons';

interface IconPickerGridProps {
  /** Currently selected icon name */
  selected: string;
  /** Callback when an icon is tapped */
  onSelect: (iconName: string) => void;
  /** Accent colour for the selection highlight */
  accentColor?: string;
}

const ICONS_PER_ROW = 5;

export function IconPickerGrid({ selected, onSelect, accentColor }: IconPickerGridProps) {
  const { theme, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const accent = accentColor ?? theme.primary;

  const filtered = useMemo(() => {
    if (!search.trim()) return SUBJECT_ICON_OPTIONS;
    const q = search.toLowerCase().trim();
    return SUBJECT_ICON_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.name.toLowerCase().includes(q) ||
        opt.keywords.some((kw) => kw.includes(q)),
    );
  }, [search]);

  const selectedIcon = selected || DEFAULT_SUBJECT_ICON;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Label */}
      <Typography variant="label">Icon</Typography>

      {/* Preview of selected icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            backgroundColor: accent + '22',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: accent + '55',
          }}
        >
          <Ionicons name={selectedIcon as IoniconName} size={24} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="captionBold" color={theme.text}>
            {SUBJECT_ICON_OPTIONS.find((o) => o.name === selectedIcon)?.label ?? 'Custom'}
          </Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            {selectedIcon}
          </Typography>
        </View>
      </View>

      {/* Search bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Ionicons name="search-outline" size={16} color={theme.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search icons…"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            color: theme.text,
            paddingVertical: spacing.sm,
            fontSize: 14,
          }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Icon grid */}
      <ScrollView
        style={{ maxHeight: 240 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {filtered.map((opt) => {
            const isSelected = selectedIcon === opt.name;
            return (
              <TouchableOpacity
                key={opt.name}
                onPress={() => onSelect(opt.name)}
                activeOpacity={0.7}
                style={{
                  width: `${100 / ICONS_PER_ROW - 2}%`,
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.lg,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? accent : theme.border,
                  backgroundColor: isSelected
                    ? accent + '18'
                    : isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)',
                  gap: 2,
                }}
              >
                <Ionicons
                  name={opt.name}
                  size={22}
                  color={isSelected ? accent : theme.textSecondary}
                />
                <Typography
                  variant="caption"
                  color={isSelected ? accent : theme.textTertiary}
                  numberOfLines={1}
                  style={{ fontSize: 8, textAlign: 'center', paddingHorizontal: 2 }}
                >
                  {opt.label}
                </Typography>
                {isSelected && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: 3,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: spacing.lg }}>
            <Typography variant="caption" color={theme.textTertiary}>
              No icons match "{search}"
            </Typography>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
