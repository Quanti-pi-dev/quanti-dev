// ─── Root Layout ────────────────────────────────────────────
// Production entry point. Sets up all providers and root navigation.

import '../src/global.css';

import { useEffect, useState, useRef, Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
import { SplashScreen, Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../src/theme';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';
import { ConfigProvider } from '../src/contexts/ConfigContext';
import { darkTheme, typography } from '../src/theme/tokens';

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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: darkTheme.background, gap: 16 }}>
          <Text style={{ color: darkTheme.text, fontSize: 20, fontWeight: '700' }}>
            Something went wrong
          </Text>
          <Text style={{ color: darkTheme.textSecondary, textAlign: 'center', fontSize: 14 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            style={{
              backgroundColor: darkTheme.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              marginTop: 8,
            }}
          >
            <Text style={{ color: darkTheme.buttonPrimaryText, fontWeight: '600', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Root Navigation ─────────────────────────────────────────

function RootNavigation() {
  const { isAuthenticated, isLoading, preferences, user } = useAuth();
  const router = useRouter();

  // Don't render navigation until we know BOTH auth state and preferences.
  // This prevents a brief flash of the wrong screen when auth resolves
  // before preferences (race condition fix).
  const isReady = !isLoading && (isAuthenticated ? preferences !== null : true);

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  const showTabs = isAuthenticated && (preferences?.onboardingCompleted ?? false);
  const showOnboarding = isAuthenticated && !preferences?.onboardingCompleted;
  const isAdmin = user?.role === 'admin';

  // FIX H4: Guard against duplicate navigation when showOnboarding toggles
  // rapidly during auth/preference hydration.
  const isNavigatingRef = useRef(false);
  useEffect(() => {
    if (showOnboarding && !isNavigatingRef.current) {
      isNavigatingRef.current = true;
      router.replace('/(onboarding)/welcome' as never);
    }
    if (!showOnboarding) {
      isNavigatingRef.current = false;
    }
  }, [showOnboarding, router]);

  const navStack = (
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {showTabs ? (
          <Stack.Screen name="(tabs)" />
        ) : showOnboarding ? (
          <Stack.Screen name="(onboarding)" />
        ) : (
          <Stack.Screen name="(auth)" />
        )}
        <Stack.Screen name="shop" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="coins-history" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="flashcards/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="exams/[examId]/subjects" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="exams/[examId]/subjects/[subjectId]/levels" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="battles" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="social/index" options={{ animation: 'slide_from_right' }} />
        {/* Admin panel: only mounted in the nav tree for admin users */}
        {isAdmin && <Stack.Screen name="(admin)" />}
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
            <ErrorBoundary>
              <AuthProvider>
                  <RootNavigation />
              </AuthProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
