import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-1 px-6 pt-2">
        <Text className="font-display text-3xl font-bold text-text-primary">Search</Text>
        <Text className="mt-2 text-text-muted">
          Search venues, events, cities, genres, and users.
        </Text>
      </View>
    </SafeAreaView>
  );
}
