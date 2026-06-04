import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { SessionResponse } from '@/lib/api/types';
import { useAuthStore } from '@/stores/authStore';
import { LoginForm, RegisterForm } from './schema';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: LoginForm) =>
      apiClient.post<SessionResponse>('/auth/login', input, true),
    onSuccess: async (res) => {
      await setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterForm) => apiClient.post('/auth/register', input, true),
  });
}

export function useLogout() {
  const { refreshToken, clear } = useAuthStore.getState();
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) await apiClient.post('/auth/logout', { refreshToken }, true).catch(() => null);
    },
    onSettled: () => clear(),
  });
}
