// ─── Battles Stack Layout ───────────────────────────────────
import { Stack } from 'expo-router';

export default function BattlesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="create" />
      <Stack.Screen name="friend-select" />
      <Stack.Screen name="lobby/[id]" />
      <Stack.Screen name="active/[id]" />
      <Stack.Screen name="result/[id]" />
    </Stack>
  );
}
