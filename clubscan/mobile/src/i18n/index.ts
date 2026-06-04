import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import tr from './tr.json';

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr } },
  lng: ['en', 'tr'].includes(deviceLocale) ? deviceLocale : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
