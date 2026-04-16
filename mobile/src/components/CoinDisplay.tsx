// ─── CoinDisplay ─────────────────────────────────────────────
// Coin icon + count. Used in Home and Shop headers.
// Audit fix: replaced raw Text with Typography, fixed gap value to use spacing token.

import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';

interface CoinDisplayProps {
  coins: number;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function CoinDisplay({ coins, size = 'md', style }: CoinDisplayProps) {
  const { theme } = useTheme();

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const variant = size === 'sm' ? 'caption' : size === 'lg' ? 'body' : 'bodySmall';

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          backgroundColor: theme.coinLight,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
    >
      <Ionicons name="ellipse" size={iconSize} color={theme.coin} />
      <Typography variant={variant} color={theme.coin} style={{ fontWeight: '700' }}>
        {coins.toLocaleString()}
      </Typography>
    </View>
  );
}
