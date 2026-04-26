// Auth stack layout
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, preferences, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      setTimeout(() => {
        if (user?.role === 'admin') {
          router.replace('/(admin)/dashboard');
        } else if (!preferences?.onboardingCompleted) {
          router.replace('/(onboarding)/welcome');
        } else {
          router.replace('/(tabs)');
        }
      }, 0);
    }
  }, [isAuthenticated, preferences, user, router]);

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
