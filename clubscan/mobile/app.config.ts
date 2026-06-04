import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo app configuration (Phase 4 §3). Deep links power event/venue sharing;
 * the API base URL and Maps key are injected via EAS env per channel.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ClubScan',
  slug: 'clubscan',
  scheme: 'clubscan',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#0A0A0F',
    resizeMode: 'contain',
  },
  ios: {
    bundleIdentifier: 'app.clubscan.mobile',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'ClubScan uses your location to show nearby venues and events.',
    },
  },
  android: {
    package: 'app.clubscan.mobile',
    adaptiveIcon: { backgroundColor: '#0A0A0F' },
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-localization', 'expo-font'],
  experiments: { typedRoutes: true },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1',
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  },
});
