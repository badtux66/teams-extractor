import { ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient, queryPersister } from '@/lib/query/queryClient';
import '@/i18n';

/** App-wide providers: server-state (persisted) + safe area. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
