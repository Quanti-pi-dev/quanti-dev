// ─── RewardCard ──────────────────────────────────────────────
// Shop item card: icon, name, coin price, unlock button.


import { View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing, typography, shadows } from '../theme/tokens';
import { Button } from './ui/Button';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface RewardCardProps {
  name: string;
  description?: string;
  icon?: IoniconName;
  price: number;
  unlocked?: boolean;
  userCoins?: number;
  onUnlock?: () => void;
  style?: ViewStyle;
}

export function RewardCard({
  name,
  description,
  icon = 'star',
  price,
  unlocked = false,
  userCoins = 0,
  onUnlock,
  style,
}: RewardCardProps) {
  const { theme } = useTheme();
  const canAfford = userCoins >= price;

  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderRadius: radius.xl,
          padding: spacing.base,
          alignItems: 'center',
          gap: spacing.sm,
          ...shadows.sm,
          shadowColor: theme.shadow,
          borderWidth: 1,
          borderColor: unlocked ? theme.success : theme.borderLight,
          opacity: unlocked ? 0.85 : 1,
        },
        style,
      ]}
    >
      {/* Icon circle */}
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius.full,
          backgroundColor: theme.coinLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={unlocked ? (icon) : 'lock-closed'} size={28} color={unlocked ? theme.coin : theme.textTertiary} />
      </View>

      <Text
        style={{
          fontFamily: typography.bodyBold,
          fontSize: typography.base,
          color: theme.text,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {name}
      </Text>

      {description && (
        <Text
          style={{
            fontFamily: typography.body,
            fontSize: typography.xs,
            color: theme.textTertiary,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {description}
        </Text>
      )}

      {/* Price */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="ellipse" size={14} color={theme.coin} />
        <Text
          style={{
            fontFamily: typography.bodyBold,
            fontSize: typography.sm,
            color: theme.coin,
          }}
        >
          {price}
        </Text>
      </View>

      <Button
        variant={unlocked ? 'secondary' : canAfford ? 'primary' : 'secondary'}
        size="sm"
        onPress={onUnlock}
        disabled={unlocked || !canAfford}
        fullWidth
      >
        {unlocked ? 'Unlocked' : canAfford ? 'Unlock' : 'Not enough coins'}
      </Button>
    </View>
  );
}
