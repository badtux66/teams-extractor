import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemePreference = 'system' | 'light' | 'dark';
type Locale = 'en' | 'tr';

interface UiState {
  theme: ThemePreference;
  locale: Locale;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
}

const THEME_KEY = 'cs.theme';
const LOCALE_KEY = 'cs.locale';

export const useUiStore = create<UiState>((set) => ({
  theme: 'system',
  locale: 'en',

  hydrate: async () => {
    const [theme, locale] = await Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(LOCALE_KEY),
    ]);
    set({
      theme: (theme as ThemePreference) ?? 'system',
      locale: (locale as Locale) ?? 'en',
    });
  },

  setTheme: (theme) => {
    void AsyncStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },

  setLocale: (locale) => {
    void AsyncStorage.setItem(LOCALE_KEY, locale);
    set({ locale });
  },
}));
