import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VenueListItem } from '@/lib/api/types';
import { ScoreRing } from '@/components/ui/ScoreRing';

const TYPE_LABEL: Record<VenueListItem['type'], string> = {
  CLUB: 'Club',
  BAR: 'Bar',
  FESTIVAL: 'Festival',
  EVENT: 'Event',
  LOUNGE: 'Lounge',
};

/** Content-forward venue card (Phase 4 §2.3) with the ClubScan Score ring. */
export function VenueCard({ venue }: { venue: VenueListItem }) {
  const router = useRouter();
  const score = venue.score ? Number(venue.score.score) : null;
  const advisory = venue.score?.safetyAdvisory;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/venue/${venue.slug}`)}
      className="mb-4 overflow-hidden rounded-lg bg-bg-surface active:opacity-90"
    >
      <View className="h-40 w-full bg-bg-elevated">
        {venue.coverPhotoUrl ? (
          <Image source={{ uri: venue.coverPhotoUrl }} className="h-full w-full" resizeMode="cover" />
        ) : null}
        {advisory ? (
          <View className="absolute left-3 top-3 rounded-pill bg-state-danger/90 px-2 py-1">
            <Text className="text-[11px] font-semibold text-white">Safety advisory</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between p-4">
        <View className="flex-1 pr-3">
          <Text className="text-[11px] uppercase tracking-wide text-text-muted">
            {TYPE_LABEL[venue.type]} · {venue.city}
          </Text>
          <Text className="mt-1 text-lg font-semibold text-text-primary" numberOfLines={1}>
            {venue.name}
          </Text>
          {venue.score ? (
            <Text className="mt-1 text-xs text-text-muted">
              {venue.score.reviewCount} reviews
            </Text>
          ) : (
            <Text className="mt-1 text-xs text-text-muted">No reviews yet</Text>
          )}
        </View>
        {score !== null ? <ScoreRing score={score} size={64} strokeWidth={6} label="score" /> : null}
      </View>
    </Pressable>
  );
}
