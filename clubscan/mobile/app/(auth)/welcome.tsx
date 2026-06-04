import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-1 justify-end px-6 pb-10">
        <Text className="font-display text-4xl font-bold text-text-primary">
          {t('auth.welcomeTitle')}
        </Text>
        <Text className="mt-3 text-base text-text-muted">{t('auth.welcomeSubtitle')}</Text>

        <View className="mt-8 gap-3">
          <Button label={t('auth.login')} onPress={() => router.push('/(auth)/login')} />
          <Button
            label={t('auth.register')}
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
