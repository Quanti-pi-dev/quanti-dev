// ─── Divider ─────────────────────────────────────────────────
// Horizontal divider with optional centered label.


import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, typography } from '../../theme/tokens';

interface DividerProps {
  label?: string;
  style?: ViewStyle;
}

export function Divider({ label, style }: DividerProps) {
  const { theme } = useTheme();

  if (label) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
        <Text
          style={{
            fontWeight: '400',
            fontSize: typography.xs,
            color: theme.textTertiary,
          }}
        >
          {label}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
      </View>
    );
  }

  return (
    <View style={[{ height: 1, backgroundColor: theme.divider }, style]} />
  );
}
