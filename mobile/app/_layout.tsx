// ─── Root Layout ────────────────────────────────────────────
// Production entry point. Sets up all providers and root navigation.

import '../src/global.css';

import { useEffect, useState, Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfairFonts,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import { SplashScreen, Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../src/theme';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';
import { ConfigProvider } from '../src/contexts/ConfigContext';
import { GlobalUIProvider } from '../src/contexts/GlobalUIContext';
import { darkTheme, spacing, radius, typography } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync();

// QueryClient config — created inside the RootLayout component using useState
// to avoid state leakage across re-mounts (React Query best practice).
const QUERY_CLIENT_OPTIONS = {
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,  // 5 min
      gcTime:  1000 * 60 * 30,   // 30 min
    },
    mutations: { retry: 1 },
  },
} as const;

// ─── Error Boundary ──────────────────────────────────────────

interface EBState { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error('[ErrorBoundary]', error.message); }

  handleReset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], backgroundColor: darkTheme.background }}>
          {/* Glassmorphic error card */}
          <View style={{
            width: '100%', maxWidth: 360,
            borderRadius: radius['2xl'],
            overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.5, shadowRadius: 36, elevation: 20,
          }}>
            <BlurView intensity={55} tint="dark" style={{
              borderWidth: 1, borderColor: 'rgba(248, 113, 113, 0.35)',
              backgroundColor: 'rgba(16, 16, 22, 0.55)',
              alignItems: 'center', padding: spacing['2xl'], gap: spacing.lg,
              borderRadius: radius['2xl'],
            }}>
              <View style={{ height: 2, width: '100%', backgroundColor: 'rgba(248, 113, 113, 0.4)', marginBottom: spacing.sm }} />
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: 'rgba(248,113,113,0.18)',
                borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 28 }}>⚠️</Text>
              </View>
              <Text style={{ color: 'rgba(240,237,232,0.96)', fontSize: 20, fontFamily: typography.heading, fontWeight: '700', textAlign: 'center' }}>
                Something went wrong
              </Text>
              <Text style={{ color: 'rgba(184,180,174,0.85)', textAlign: 'center', fontSize: 14, fontFamily: typography.body, lineHeight: 22 }}>
                {this.state.error?.message ?? 'An unexpected error occurred.'}
              </Text>
              <TouchableOpacity
                onPress={this.handleReset}
                style={{
                  backgroundColor: 'rgba(96,165,250,0.18)',
                  borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)',
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
                  borderRadius: radius.xl, marginTop: spacing.sm,
                }}
              >
                <Text style={{ color: '#60A5FA', fontFamily: typography.bodySemiBold, fontSize: 16 }}>Try Again</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Root Navigation ─────────────────────────────────────────

function RootNavigation() {
  const { isAuthenticated, isLoading, preferences } = useAuth();

  // Don't render navigation until we know BOTH auth state and preferences.
  // This prevents a brief flash of the wrong screen when auth resolves
  // before preferences (race condition fix).
  const isReady = !isLoading && (isAuthenticated ? preferences !== null : true);

  // FIX H4: We now use the root `app/index.tsx` redirector to handle auth flow.
  // There is no need to conditionally evaluate route inclusions or perform
  // manual redirects here, as Expo Router's file system resolves paths naturally.

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  const navStack = (
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="shop" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="coins-history" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="flashcards/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="exams/[examId]/subjects" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="battles" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="social/index" options={{ animation: 'slide_from_right' }} />
      </Stack>
  );

  // Only mount SubscriptionProvider when authenticated — prevents premature
  // 401 fetches before auth tokens are ready.
  if (isAuthenticated) {
    return <ConfigProvider><SubscriptionProvider>{navStack}</SubscriptionProvider></ConfigProvider>;
  }
  return navStack;
}

// ─── Root ─────────────────────────────────────────────────────

export default function RootLayout() {
  // QueryClient inside component lifecycle — prevents state leakage
  const [queryClient] = useState(() => new QueryClient(QUERY_CLIENT_OPTIONS));

  const [playfairLoaded, playfairError] = usePlayfairFonts({ PlayfairDisplay_400Regular, PlayfairDisplay_700Bold });
  const [interLoaded, interError] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  // 3-second fallback in case fonts never resolve (fails gracefully with system font)
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Proceed if both fonts loaded, or either errored, or timeout exceeded
  const fontsReady = (playfairLoaded || !!playfairError) && (interLoaded || !!interError);
  if (!fontsReady && !fontTimeout) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <GlobalUIProvider>
              <ErrorBoundary>
                <AuthProvider>
                    <RootNavigation />
                </AuthProvider>
              </ErrorBoundary>
            </GlobalUIProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
