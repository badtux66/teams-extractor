import Constants from 'expo-constants';

interface Extra {
  apiBaseUrl: string;
  googleMapsApiKey: string;
  sentryDsn: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:3000/api/v1',
  googleMapsApiKey: extra.googleMapsApiKey ?? '',
  sentryDsn: extra.sentryDsn ?? '',
};
