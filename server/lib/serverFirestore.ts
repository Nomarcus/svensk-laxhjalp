import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Klienten använder en namngiven Firestore (firebase-applet-config.json → firestoreDatabaseId).
 * admin.firestore() utan id läser bara "(default)" — tom om all data ligger i den namngivna DB.
 */
export function resolveFirestoreDatabaseId(): string | undefined {
  const env = process.env.FIRESTORE_DATABASE_ID?.trim();
  if (env) return env;
  const p = resolve(process.cwd(), 'firebase-applet-config.json');
  if (!existsSync(p)) return undefined;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8')) as { firestoreDatabaseId?: string };
    return j.firestoreDatabaseId?.trim() || undefined;
  } catch {
    return undefined;
  }
}

let cached: Firestore | null = null;

export function getServerFirestore(): Firestore {
  if (cached) return cached;
  const id = resolveFirestoreDatabaseId();
  const app = getApp();
  cached = id ? getFirestore(app, id) : getFirestore(app);
  return cached;
}
