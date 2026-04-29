// ─── BadgeItem ───────────────────────────────────────────────
// Badge grid item — earned (full color) vs unearned (grayscale + lock).


import { View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing, typography } from '../theme/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface BadgeItemProps {
  name: string;
  icon?: IoniconName;
  earned?: boolean;
  accent?: string;
  style?: ViewStyle;
}

export function BadgeItem({
  name,
  icon = 'ribbon',
  earned = false,
  accent,
  style,
}: BadgeItemProps) {
  const { theme } = useTheme();
  const color = earned ? (accent ?? theme.coin) : theme.textTertiary;

  return (
    <View
      style={[
        {
          alignItems: 'center',
          gap: spacing.xs,
          width: 72,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.full,
          backgroundColor: earned ? color + '20' : theme.cardAlt,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: earned ? color : theme.border,
          opacity: earned ? 1 : 0.5,
        }}
      >
        <Ionicons
          name={earned ? icon : 'lock-closed-outline'}
          size={24}
          color={color}
        />
      </View>

      <Text
        style={{
          fontWeight: '400',
          fontSize: typography.xs,
          color: earned ? theme.text : theme.textTertiary,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );
}
