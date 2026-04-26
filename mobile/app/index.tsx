import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/theme';

export default function RootIndex() {
  const { isAuthenticated, isLoading, preferences, user } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={'/(auth)/signup' as any} />;
  }

  if (user?.role === 'admin') {
    return <Redirect href={'/(admin)/dashboard' as any} />;
  }

  if (!preferences?.onboardingCompleted) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
