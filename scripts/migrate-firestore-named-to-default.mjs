/**
 * Kopierar rekursivt all data från namngiven Firestore till (default).
 * Kräver Application Default Credentials:
 *   gcloud auth application-default login
 * eller GOOGLE_APPLICATION_CREDENTIALS till en service account JSON.
 * Kör från repo-rot: npm run migrate:firestore
 *
 * Resume/checkpoint:
 *  - Scriptet sparar progress i scripts/.firestore-migration-checkpoint.json
 *  - Om det avbryts fortsätter nästa körning från nästa user-dokument.
 *  - För full omstart: npm run migrate:firestore:reset
 */
import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'lead-agent-489101';
const SOURCE_DB = 'ai-studio-8af631ef-cd5d-43bc-94dd-19902f5cf06f';
const ROOT_COLLECTION = 'users';
const CHECKPOINT_PATH = resolve(process.cwd(), 'scripts/.firestore-migration-checkpoint.json');

if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID,
    credential: applicationDefault(),
  });
}

const app = getApp();
const source = getFirestore(app, SOURCE_DB);
const dest = getFirestore(app);

let docsCopied = 0;
let usersDoneThisRun = 0;

function defaultCheckpoint() {
  return {
    rootCollection: ROOT_COLLECTION,
    lastCompletedUserId: null,
    usersCompletedTotal: 0,
    docsCopiedTotal: 0,
    updatedAt: null,
  };
}

function readCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return defaultCheckpoint();
  try {
    const raw = readFileSync(CHECKPOINT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultCheckpoint(),
      ...parsed,
    };
  } catch (err) {
    console.warn('Kunde inte läsa checkpoint, startar från början.');
    console.warn(err);
    return defaultCheckpoint();
  }
}

function writeCheckpoint(cp) {
  const next = {
    ...cp,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(CHECKPOINT_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

async function copyDocRecursive(sourceDocRef, destDocRef) {
  const snap = await sourceDocRef.get();
  if (!snap.exists) return;

  const data = snap.data();
  await destDocRef.set(data && typeof data === 'object' ? data : {});

  docsCopied += 1;
  if (docsCopied % 200 === 0) {
    console.log(`  ... ${docsCopied} dokument`);
  }

  const cols = await sourceDocRef.listCollections();
  for (const col of cols) {
    const subSnap = await col.get();
    for (const d of subSnap.docs) {
      await copyDocRecursive(d.ref, destDocRef.collection(col.id).doc(d.id));
    }
  }
}

async function main() {
  const resetRequested = process.argv.includes('--reset');
  if (resetRequested && existsSync(CHECKPOINT_PATH)) {
    unlinkSync(CHECKPOINT_PATH);
    console.log('Checkpoint raderad. Full omstart.');
  }

  const checkpoint = readCheckpoint();
  console.log(`Källa: ${SOURCE_DB} → mål: (default)`);
  console.log(`Checkpoint-fil: ${CHECKPOINT_PATH}`);

  const usersSnap = await source
    .collection(ROOT_COLLECTION)
    .orderBy(FieldPath.documentId())
    .get();
  console.log(`Hittade ${usersSnap.size} användardokument (toppnivå).`);

  if (checkpoint.lastCompletedUserId) {
    console.log(`Resume från user-id efter: ${checkpoint.lastCompletedUserId}`);
  }

  let shouldProcess = checkpoint.lastCompletedUserId === null;
  let foundCheckpointDoc = checkpoint.lastCompletedUserId === null;
  for (const u of usersSnap.docs) {
    if (!shouldProcess) {
      if (u.id === checkpoint.lastCompletedUserId) {
        foundCheckpointDoc = true;
        shouldProcess = true;
      }
      continue;
    }
    if (u.id === checkpoint.lastCompletedUserId) {
      continue;
    }

    console.log(`Användare ${u.id}`);
    await copyDocRecursive(u.ref, dest.collection(ROOT_COLLECTION).doc(u.id));
    usersDoneThisRun += 1;

    const nextCp = {
      ...checkpoint,
      lastCompletedUserId: u.id,
      usersCompletedTotal: Number(checkpoint.usersCompletedTotal || 0) + usersDoneThisRun,
      docsCopiedTotal: Number(checkpoint.docsCopiedTotal || 0) + docsCopied,
    };
    writeCheckpoint(nextCp);
  }

  if (!foundCheckpointDoc && checkpoint.lastCompletedUserId) {
    console.warn(
      'Checkpoint-user hittades inte i aktuell query. Nästa körning startar från början om du kör reset.'
    );
  }

  if (existsSync(CHECKPOINT_PATH)) {
    unlinkSync(CHECKPOINT_PATH);
    console.log('Checkpoint borttagen (migrering klar).');
  }
  console.log(`Klart. Totalt ca ${docsCopied} dokument skrivna till (default).`);
}

main().catch((e) => {
  const msg = String(e?.message ?? e);
  if (msg.includes('default credentials') || msg.includes('Could not load')) {
    console.error(
      'Ingen ADC: kör `gcloud auth application-default login` (eller sätt GOOGLE_APPLICATION_CREDENTIALS).'
    );
  }
  console.error(e);
  process.exit(1);
});
