import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function OnboardingLayout() {
  const router = useRouter();
  const { user, preferences } = useAuth();

  // Redirect to main app if onboarding is already complete (FIX C4)
  useEffect(() => {
    if (user && preferences?.onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [user, preferences, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 300,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="index" />
      <Stack.Screen name="subjects" />
      <Stack.Screen name="exam-goals" />
      <Stack.Screen name="email-prompt" />
      <Stack.Screen name="complete" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
