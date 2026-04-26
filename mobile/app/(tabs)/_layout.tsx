// ─── Tab Layout ──────────────────────────────────────────────
// Bottom tabs with custom TabBar component.
// Wrapped in RouteErrorBoundary so a crash in any tab shows recovery UI.

import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { TabBar } from '../../src/components/TabBar';
import { RouteErrorBoundary } from '../../src/components/ui/RouteErrorBoundary';

export default function TabLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href={'/(auth)/signup' as any} />;
  }

  return (
    <RouteErrorBoundary fallbackTitle="This screen crashed">
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="study" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="gamify" />
        <Tabs.Screen name="battles" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </RouteErrorBoundary>
  );
}
