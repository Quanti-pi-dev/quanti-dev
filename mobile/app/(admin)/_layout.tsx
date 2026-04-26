// Admin stack layout with role guard + error boundary
import { Component, type ReactNode } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Redirect } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { spacing, radius } from '../../src/theme/tokens';
import { ToastProvider } from '../../src/contexts/ToastContext';

// ─── Error Boundary (E7) ─────────────────────────────────────
// Catches Zod parse failures, network errors, and rendering
// crashes inside any admin screen without killing the whole panel.

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1, justifyContent: 'center', alignItems: 'center',
          padding: spacing['2xl'], gap: spacing.lg,
          backgroundColor: '#0F0F14',
        }}>
          <View style={{
            width: 64, height: 64, borderRadius: radius.full,
            backgroundColor: '#EF444422', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography variant="h2" color="#EF4444">!</Typography>
          </View>
          <Typography variant="h4" color="#FFFFFF" style={{ textAlign: 'center' }}>
            Something went wrong
          </Typography>
          <Typography variant="body" color="#9CA3AF" style={{ textAlign: 'center' }}>
            {this.state.error?.message ?? 'An unexpected error occurred in the admin panel.'}
          </Typography>
          <TouchableOpacity
            onPress={this.handleReset}
            style={{
              paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
              backgroundColor: '#6366F1', borderRadius: radius.lg,
              marginTop: spacing.md,
            }}
          >
            <Typography variant="label" color="#FFFFFF">Try Again</Typography>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Layout ──────────────────────────────────────────────────

export default function AdminLayout() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href={'/(auth)/signup' as any} />;
  if (user?.role !== 'admin') return <Redirect href="/(tabs)" />;
  return (
    <AdminErrorBoundary>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </ToastProvider>
    </AdminErrorBoundary>
  );
}
