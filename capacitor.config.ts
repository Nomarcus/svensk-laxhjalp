import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.foraldrahjalpen.app',
  appName: 'Föräldrahjälpen',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['apple.com', 'google.com'],
    },
    // Route fetch/XMLHttpRequest through URLSession on iOS. This avoids
    // WebView CORS failures ("Load Failed") when calling the Cloud Run API.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
