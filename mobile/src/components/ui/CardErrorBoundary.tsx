// ─── CardErrorBoundary ──────────────────────────────────────
// Lightweight error boundary for individual flashcard rendering.
// If a card's content (e.g. malformed LaTeX, corrupt data) causes a
// React render crash, this catches it and shows a "Skip this card"
// fallback instead of killing the entire study session.

import { Component, ReactNode } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkTheme, spacing, radius } from '../../theme/tokens';
import { Typography } from './Typography';

interface Props {
  children: ReactNode;
  /** Called when the user taps "Skip this card". */
  onSkip?: () => void;
}

interface State {
  hasError: boolean;
}

export class CardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleSkip = () => {
    this.props.onSkip?.();
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use darkTheme as a safe static fallback
    const theme = darkTheme;

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['2xl'],
          gap: spacing.lg,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: theme.errorMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="alert-circle-outline" size={30} color={theme.error} />
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Typography variant="h4" align="center" color={theme.text}>
            Card couldn't load
          </Typography>
          <Typography variant="bodySmall" color={theme.textSecondary} align="center">
            This card has a rendering issue. You can skip it and continue studying.
          </Typography>
        </View>

        {this.props.onSkip && (
          <TouchableOpacity
            onPress={this.handleSkip}
            activeOpacity={0.8}
            style={{
              backgroundColor: theme.primary,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
            }}
          >
            <Typography variant="label" color={theme.buttonPrimaryText}>
              Skip this card
            </Typography>
          </TouchableOpacity>
        )}
      </View>
    );
  }
}
