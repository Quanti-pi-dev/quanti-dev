// ─── Subjects Layout ─────────────────────────────────────────
// Nested Stack for the subjects flow: Subject List → Levels.
// Enables coexistence of subjects/index.tsx and subjects/[subjectId]/levels.tsx.

import { Stack } from 'expo-router';

export default function SubjectsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
