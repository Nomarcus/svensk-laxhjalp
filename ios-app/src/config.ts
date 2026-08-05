import Constants from 'expo-constants';

/**
 * Same public Firebase web config as the existing site. These values identify
 * the Firebase project and are safe to ship in clients; secrets stay in the API.
 */
export const firebaseConfig = {
  projectId: 'lead-agent-489101',
  appId: '1:288867992327:web:b5482e565865fdca7a7ba2',
  apiKey: 'AIzaSyCy4s5ywxkvVC7MuTcLYE-b3WbKRe_y9eg',
  authDomain: 'lead-agent-489101.firebaseapp.com',
  storageBucket: 'lead-agent-489101.firebasestorage.app',
  messagingSenderId: '288867992327',
  measurementId: '',
};

const extra = Constants.expoConfig?.extra as { apiOrigin?: string } | undefined;

/** Same Cloud Run API used by the production website. */
export const API_ORIGIN = (extra?.apiOrigin || 'https://laxhjalp-api-288867992327.europe-west1.run.app').replace(/\/$/, '');

/** Product ids must match App Store Connect before TestFlight/App Store testing. */
export const APPLE_SUBSCRIPTION_PRODUCT_IDS = ['foraldrahjalpen_monthly'];
