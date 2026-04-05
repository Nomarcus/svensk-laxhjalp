import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Klienten använder en namngiven Firestore (firebase-applet-config.json → firestoreDatabaseId).
 * admin.firestore() utan id läser bara "(default)" — då syns users men ofta inga children (data ligger i annan DB).
 */
function appletConfigPaths(): string[] {
  const cwd = resolve(process.cwd(), 'firebase-applet-config.json');
  const fromLib = join(dirname(fileURLToPath(import.meta.url)), '../../firebase-applet-config.json');
  return [cwd, resolve(fromLib)];
}

export function resolveFirestoreDatabaseId(): string | undefined {
  const env = process.env.FIRESTORE_DATABASE_ID?.trim();
  if (env) return env;
  for (const p of appletConfigPaths()) {
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, 'utf8')) as { firestoreDatabaseId?: string };
      const id = j.firestoreDatabaseId?.trim();
      if (id) return id;
    } catch {
      /* prova nästa sökväg */
    }
  }
  return undefined;
}

let cached: Firestore | null = null;

export function getServerFirestore(): Firestore {
  if (cached) return cached;
  const id = resolveFirestoreDatabaseId();
  const app = getApp();
  if (process.env.NODE_ENV === 'production') {
    console.info(`[firestore] using database: ${id ?? '(default) — WARNING: set FIRESTORE_DATABASE_ID if app uses a named DB)'}`);
  }
  cached = id ? getFirestore(app, id) : getFirestore(app);
  return cached;
}
