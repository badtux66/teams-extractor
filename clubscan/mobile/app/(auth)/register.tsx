import { View, Text, TextInput, ScrollView } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { RegisterForm, registerSchema } from '@/features/auth/schema';
import { useRegister } from '@/features/auth/mutations';
import { ApiError } from '@/lib/api/errors';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const register = useRegister();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', password: '' },
  });

  const onSubmit = (values: RegisterForm) =>
    register.mutate(values, { onSuccess: () => router.replace('/(auth)/login') });
  const serverError = register.error instanceof ApiError ? register.error.message : null;

  const fields: { name: keyof RegisterForm; label: string; secure?: boolean }[] = [
    { name: 'email', label: t('auth.email') },
    { name: 'username', label: t('auth.username') },
    { name: 'password', label: t('auth.password'), secure: true },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView className="flex-1 px-6 pt-12" keyboardShouldPersistTaps="handled">
        <Text className="font-display text-3xl font-bold text-text-primary">
          {t('auth.register')}
        </Text>

        <View className="mt-8 gap-4">
          {fields.map((f) => (
            <View key={f.name} className="gap-1.5">
              <Text className="text-sm text-text-muted">{f.label}</Text>
              <Controller
                control={control}
                name={f.name}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="h-12 rounded-md bg-bg-surface px-4 text-text-primary"
                    placeholderTextColor="#A1A1B5"
                    autoCapitalize="none"
                    secureTextEntry={f.secure}
                    keyboardType={f.name === 'email' ? 'email-address' : 'default'}
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
              {errors[f.name] ? (
                <Text className="text-xs text-state-danger">{errors[f.name]?.message}</Text>
              ) : null}
            </View>
          ))}

          {serverError ? <Text className="text-sm text-state-danger">{serverError}</Text> : null}

          <Button
            label={t('auth.register')}
            loading={register.isPending}
            onPress={handleSubmit(onSubmit)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
