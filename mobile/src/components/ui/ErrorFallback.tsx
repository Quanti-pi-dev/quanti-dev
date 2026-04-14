// ─── ErrorFallback ──────────────────────────────────────────
// Reusable error boundary fallback for route-level boundaries.
// Expo Router automatically uses `ErrorBoundary` named exports
// from route files: export { ErrorBoundary } from '../../src/components/ui/ErrorFallback';

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Typography } from './Typography';
import { Button } from './Button';
import { spacing, radius } from '../../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

export function ErrorBoundary({ error, retry }: ErrorFallbackProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.errorMuted }]}>
          <Ionicons name="warning-outline" size={32} color={theme.error} />
        </View>

        <Typography variant="h4" align="center" style={{ marginBottom: spacing.sm }}>
          Something went wrong
        </Typography>

        <Typography
          variant="body"
          color={theme.textSecondary}
          align="center"
          style={{ marginBottom: spacing.xl }}
        >
          {error.message || 'An unexpected error occurred. Please try again.'}
        </Typography>

        <Button
          onPress={retry}
          variant="primary"
          fullWidth
        >
          Try Again
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
