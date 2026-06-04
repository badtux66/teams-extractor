import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VenueCard } from '@/components/domain/VenueCard';
import { useVenues } from '@/features/venues/queries';

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useVenues({ sort: 'score' });

  const venues = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="px-6 pb-2 pt-2">
        <Text className="font-display text-3xl font-bold text-text-primary">
          {t('discover.title')}
        </Text>
        <Text className="mt-1 text-sm text-text-muted">{t('discover.topVenues')}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C5CFC" />
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => <VenueCard venue={item} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <Text className="mt-12 text-center text-text-muted">{t('discover.empty')}</Text>
          }
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color="#7C5CFC" className="my-4" /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}
