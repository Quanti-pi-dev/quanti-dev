// ─── ActivityItem ─────────────────────────────────────────────
// Recent study activity list row.


import { View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing, typography } from '../theme/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ActivityItemProps {
  examName: string;
  cardsStudied: number;
  accuracy: number; // 0–100
  timeAgo: string;
  icon?: IoniconName;
  style?: ViewStyle;
}

export function ActivityItem({
  examName,
  cardsStudied,
  accuracy,
  timeAgo,
  icon = 'book-outline',
  style,
}: ActivityItemProps) {
  const { theme } = useTheme();
  const accuracyColor = accuracy >= 70 ? theme.success : accuracy >= 40 ? theme.coin : theme.error;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
    >
      {/* Icon */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.lg,
          backgroundColor: theme.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.bodySemiBold,
            fontSize: typography.sm,
            color: theme.text,
          }}
          numberOfLines={1}
        >
          {examName}
        </Text>
        <Text
          style={{
            fontFamily: typography.body,
            fontSize: typography.xs,
            color: theme.textTertiary,
          }}
        >
          {cardsStudied} cards · {timeAgo}
        </Text>
      </View>

      {/* Accuracy */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontFamily: typography.bodyBold,
            fontSize: typography.sm,
            color: accuracyColor,
          }}
        >
          {accuracy}%
        </Text>
        <Text
          style={{
            fontFamily: typography.body,
            fontSize: typography.xs,
            color: theme.textTertiary,
          }}
        >
          accuracy
        </Text>
      </View>
    </View>
  );
}
