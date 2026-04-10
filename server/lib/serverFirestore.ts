import { getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export function resolveFirestoreDatabaseId(): string | undefined {
  const env = process.env.FIRESTORE_DATABASE_ID?.trim();
  return env || undefined;
}

let cached: Firestore | null = null;

export function getServerFirestore(): Firestore {
  if (cached) return cached;
  const app = getApp();
  if (process.env.NODE_ENV === 'production') {
    console.info('[firestore] using database: (default)');
  }
  cached = getFirestore(app);
  return cached;
}
