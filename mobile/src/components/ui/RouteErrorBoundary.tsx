// ─── RouteErrorBoundary ──────────────────────────────────────
// Reusable error boundary for route groups (tabs, study, etc.).
// Unlike the root ErrorBoundary which blanks the entire app,
// this renders a contextual recovery UI scoped to the crashed route.
//
// Usage:
//   <RouteErrorBoundary>
//     <Tabs ... />
//   </RouteErrorBoundary>

import { Component, ReactNode } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkTheme, spacing, radius, typography } from '../../theme/tokens';
import { Typography } from './Typography';

interface Props {
  children: ReactNode;
  /** Fallback message shown above the error. */
  fallbackTitle?: string;
  /** If provided, called when the user presses "Try Again". */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use darkTheme as a safe static fallback — ThemeContext may not be available
    // if the crash happened during provider initialization.
    const theme = darkTheme;
    const title = this.props.fallbackTitle ?? 'Something went wrong';

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['2xl'],
          backgroundColor: theme.background,
          gap: spacing.xl,
        }}
      >
        {/* Error icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            backgroundColor: theme.errorMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="warning-outline" size={36} color={theme.error} />
        </View>

        {/* Title & message */}
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="h3" align="center" color={theme.text}>
            {title}
          </Typography>
          <Typography
            variant="body"
            color={theme.textSecondary}
            align="center"
          >
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Typography>
        </View>

        {/* Action buttons */}
        <View style={{ gap: spacing.sm, width: '100%', maxWidth: 280 }}>
          <TouchableOpacity
            onPress={this.handleReset}
            activeOpacity={0.85}
            style={{
              backgroundColor: theme.primary,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
              alignItems: 'center',
            }}
          >
            <Typography
              variant="label"
              color={theme.buttonPrimaryText}
              style={{
                fontFamily: typography.bodySemiBold,
                fontSize: typography.base,
              }}
            >
              Try Again
            </Typography>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
