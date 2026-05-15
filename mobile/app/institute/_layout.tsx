import { Stack } from 'expo-router';

export default function InstituteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="join" />
      <Stack.Screen name="leaderboard/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="tests/[testId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="tests/[testId]/result" options={{ animation: 'fade' }} />
    </Stack>
  );
}
