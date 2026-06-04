import { Tabs } from 'expo-router';

/** Authenticated tab bar (Phase 4 §3). */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#14141C', borderTopColor: '#2A2A38' },
        tabBarActiveTintColor: '#7C5CFC',
        tabBarInactiveTintColor: '#A1A1B5',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
