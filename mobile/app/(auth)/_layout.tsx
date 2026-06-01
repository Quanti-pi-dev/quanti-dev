// Auth stack layout
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, preferences } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      setTimeout(() => {
        if (!preferences?.onboardingCompleted) {
          router.replace('/(onboarding)/welcome');
        } else {
          router.replace('/(tabs)');
        }
      }, 0);
    }
  }, [isAuthenticated, preferences, router]);

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
