import { View, Text, TextInput } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { LoginForm, loginSchema } from '@/features/auth/schema';
import { useLogin } from '@/features/auth/mutations';
import { ApiError } from '@/lib/api/errors';

export default function LoginScreen() {
  const { t } = useTranslation();
  const login = useLogin();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginForm) => login.mutate(values);
  const serverError = login.error instanceof ApiError ? login.error.message : null;

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-1 px-6 pt-12">
        <Text className="font-display text-3xl font-bold text-text-primary">{t('auth.login')}</Text>

        <View className="mt-8 gap-4">
          <Field label={t('auth.email')} error={errors.email?.message}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="h-12 rounded-md bg-bg-surface px-4 text-text-primary"
                  placeholder="you@example.com"
                  placeholderTextColor="#A1A1B5"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </Field>

          <Field label={t('auth.password')} error={errors.password?.message}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="h-12 rounded-md bg-bg-surface px-4 text-text-primary"
                  placeholder="••••••••"
                  placeholderTextColor="#A1A1B5"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </Field>

          {serverError ? <Text className="text-sm text-state-danger">{serverError}</Text> : null}

          <Button label={t('auth.login')} loading={login.isPending} onPress={handleSubmit(onSubmit)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm text-text-muted">{label}</Text>
      {children}
      {error ? <Text className="text-xs text-state-danger">{error}</Text> : null}
    </View>
  );
}
