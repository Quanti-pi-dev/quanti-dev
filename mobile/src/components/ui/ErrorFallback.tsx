// ─── ErrorFallback ──────────────────────────────────────────
// Reusable error boundary fallback for route-level boundaries.
// Expo Router automatically uses `ErrorBoundary` named exports
// from route files: export { ErrorBoundary } from '../../src/components/ui/ErrorFallback';

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
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
      {/* Glassmorphic error card */}
      <View style={styles.cardWrapper}>
        <BlurView
          intensity={55}
          tint="dark"
          style={[
            styles.card,
            { borderColor: 'rgba(248, 113, 113, 0.35)' },
          ]}
        >
          <View style={styles.topGlow} />
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(248,113,113,0.18)', borderColor: 'rgba(248,113,113,0.35)' }]}>
            <Ionicons name="warning-outline" size={30} color="#F87171" />
          </View>

          <Typography variant="h4" align="center" color="rgba(240, 237, 232, 0.96)" style={{ marginBottom: spacing.sm }}>
            Something went wrong
          </Typography>

          <Typography
            variant="body"
            color="rgba(184, 180, 174, 0.85)"
            align="center"
            style={{ marginBottom: spacing.xl, lineHeight: 22 }}
          >
            {error.message || 'An unexpected error occurred. Please try again.'}
          </Typography>

          <Button
            onPress={retry}
            variant="secondary"
            fullWidth
          >
            Try Again
          </Button>
        </BlurView>
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
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 20,
  },
  card: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    padding: spacing['2xl'],
    backgroundColor: 'rgba(16, 16, 22, 0.55)',
  },
  topGlow: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(248, 113, 113, 0.4)',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
