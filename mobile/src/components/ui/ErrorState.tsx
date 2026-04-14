// ─── ErrorState ──────────────────────────────────────────────
// Reusable error view with icon, message, and retry button.
// Drop into any screen that needs graceful error recovery.

import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from './Typography';
import { Button } from './Button';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  icon?: IoniconName;
  retryLabel?: string;
  style?: ViewStyle;
}

export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
  icon = 'cloud-offline-outline',
  retryLabel = 'Try Again',
  style,
}: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.lg,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          backgroundColor: theme.errorMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={32} color={theme.error} />
      </View>

      <Typography variant="body" color={theme.textSecondary} align="center">
        {message}
      </Typography>

      {onRetry && (
        <Button variant="secondary" size="md" onPress={onRetry}>
          {retryLabel}
        </Button>
      )}
    </View>
  );
}
