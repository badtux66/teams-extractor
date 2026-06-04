import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '@/components/Providers';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import '../global.css';

/**
 * Root layout: hydrates persisted session + UI prefs, then gates navigation
 * between the (auth) and (tabs) groups based on authentication (Phase 4 §3).
 */
function RootNavigator() {
  const segments = useSegments();
  const router = useRouter();
  const { hydrated, hydrate, isAuthenticated } = useAuthStore();
  const hydrateUi = useUiStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([hydrate(), hydrateUi()]).then(() => setReady(true));
  }, [hydrate, hydrateUi]);

  useEffect(() => {
    if (!ready || !hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, hydrated, isAuthenticated, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="venue/[slug]" options={{ headerShown: false, presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <RootNavigator />
    </Providers>
  );
}
