import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, { container: string; text: string }> = {
  primary: { container: 'bg-brand-primary', text: 'text-white' },
  secondary: { container: 'bg-bg-surface border border-border', text: 'text-text-primary' },
  ghost: { container: 'bg-transparent', text: 'text-brand-primary' },
  danger: { container: 'bg-state-danger', text: 'text-white' },
};

/** Themed, accessible button primitive (Phase 4 §2.3). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const styles = VARIANT_CLASSES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`h-12 flex-row items-center justify-center rounded-md px-5 ${styles.container} ${
        isDisabled ? 'opacity-50' : 'active:opacity-80'
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`text-base font-semibold ${styles.text}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
