import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { useVenue, useVenueReviews } from '@/features/venues/queries';

const CATEGORY_LABELS: Record<string, string> = {
  security: 'Security',
  staffBehavior: 'Staff',
  fairPricing: 'Pricing',
  crowdQuality: 'Crowd',
  musicQuality: 'Music',
  soundSystem: 'Sound',
  cleanliness: 'Clean',
  safetyForWomen: 'Safety (W)',
  atmosphere: 'Vibe',
};

export default function VenueDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { data: venue, isLoading } = useVenue(slug ?? '');
  const reviews = useVenueReviews(venue?.id ?? '');

  if (isLoading || !venue) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base">
        <ActivityIndicator color="#7C5CFC" />
      </SafeAreaView>
    );
  }

  const score = venue.score ? Number(venue.score.score) : 0;
  const reviewItems = reviews.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <ScrollView>
        <View className="h-56 w-full bg-bg-elevated">
          {venue.coverPhotoUrl ? (
            <Image source={{ uri: venue.coverPhotoUrl }} className="h-full w-full" resizeMode="cover" />
          ) : null}
        </View>

        <View className="px-6 pt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xs uppercase tracking-wide text-text-muted">
                {venue.type} · {venue.city}, {venue.country}
              </Text>
              <Text className="mt-1 font-display text-2xl font-bold text-text-primary">
                {venue.name}
              </Text>
            </View>
            <ScoreRing score={score} label={t('venue.score')} />
          </View>

          {venue.score?.safetyAdvisory ? (
            <View className="mt-4 rounded-md bg-state-danger/15 p-3">
              <Text className="text-sm font-semibold text-state-danger">
                {t('venue.safetyAdvisory')}
              </Text>
            </View>
          ) : null}

          {venue.description ? (
            <Text className="mt-4 text-base leading-6 text-text-muted">{venue.description}</Text>
          ) : null}

          <Text className="mt-8 text-lg font-semibold text-text-primary">{t('venue.reviews')}</Text>
          {reviewItems.length === 0 ? (
            <Text className="mt-2 text-text-muted">No reviews yet.</Text>
          ) : (
            reviewItems.map((review) => (
              <View key={review.id} className="mt-4 rounded-lg bg-bg-surface p-4">
                <Text className="text-sm font-semibold text-text-primary">
                  @{review.user.profile?.username ?? 'user'}
                </Text>
                <Text className="mt-2 text-text-muted">{review.body}</Text>
                {review.rating ? (
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {Object.entries(review.rating)
                      .filter(([k]) => CATEGORY_LABELS[k])
                      .map(([k, v]) => (
                        <View key={k} className="rounded-pill bg-bg-elevated px-2 py-1">
                          <Text className="text-[11px] text-text-muted">
                            {CATEGORY_LABELS[k]} {v}
                          </Text>
                        </View>
                      ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
