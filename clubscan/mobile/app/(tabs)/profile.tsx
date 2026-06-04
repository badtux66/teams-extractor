import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/features/auth/mutations';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-1 px-6 pt-2">
        <Text className="font-display text-3xl font-bold text-text-primary">Profile</Text>
        {user ? (
          <View className="mt-4">
            <Text className="text-text-primary">{user.email}</Text>
            <Text className="mt-1 text-text-muted">Reputation: {user.reputationScore}</Text>
          </View>
        ) : null}
        <View className="mt-8">
          <Button label="Log out" variant="secondary" onPress={() => logout.mutate()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
