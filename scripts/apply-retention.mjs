#!/usr/bin/env node
/**
 * Gallring av personuppgifter.
 *
 * GDPR:s princip om lagringsminimering (art. 5.1 e) kräver att uppgifter inte
 * sparas längre än nödvändigt. Appen sparade tidigare barnens läxfoton och
 * chattar utan någon bortre gräns alls.
 *
 * Två nivåer, eftersom risken och nyttan skiljer sig åt:
 *
 *   1. Bilderna tas bort först. Ett läxfoto kan visa barnets namn i handstil,
 *      skolans namn, ibland uppgifter om familj eller hälsa i en uppsats. Det
 *      är den känsligaste datan i appen och den som åldras snabbast i nytta.
 *      Själva texten i svaret behålls — den är det föräldern går tillbaka till.
 *
 *   2. Meddelanden, sessioner och uppgifter raderas helt senare.
 *
 * Biblioteket rörs inte. Det innehåller det föräldern aktivt valt att spara,
 * och att radera det vore att ta bort en funktion snarare än att minimera data.
 * Det försvinner när kontot raderas.
 *
 * Körs schemalagt av .github/workflows/retention.yml. Autentiseras med ADC,
 * alltså samma Workload Identity-inloggning som deployerna.
 *
 *   node scripts/apply-retention.mjs --dry-run   # visar vad som skulle hända
 *   node scripts/apply-retention.mjs             # utför gallringen
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (name, fallback) => {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Ändras dessa måste även integritetspolicyn uppdateras — tiderna står där. */
const IMAGE_DAYS = num('RETENTION_IMAGE_DAYS', 90);
const MESSAGE_DAYS = num('RETENTION_MESSAGE_DAYS', 365);
const TASK_DAYS = num('RETENTION_TASK_DAYS', 365);
const SESSION_DAYS = num('RETENTION_SESSION_DAYS', 365);

const DRY_RUN = process.argv.includes('--dry-run');
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'lead-agent-489101';

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

/**
 * Tidsstämplarna är inte enhetliga i databasen: de flesta skrevs med
 * serverTimestamp() och är Firestore-Timestamps, men planeraren har skrivit
 * ISO-strängar. Gallringen måste förstå båda, annars vore just de dokumenten
 * osynliga för den — och osynliga dokument är precis de som blir kvar för evigt.
 */
function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'number') return value;
  return null;
}

function ageInDays(data, fields) {
  for (const field of fields) {
    const ms = toMillis(data[field]);
    if (ms !== null) return (Date.now() - ms) / DAY_MS;
  }
  // Saknar dokumentet tidsstämpel går åldern inte att avgöra. Att gissa vore att
  // riskera radering av färsk data, så det lämnas och rapporteras i stället.
  return null;
}

/**
 * Läser bara de fält som behövs för beslutet. Utan select() skulle varje
 * körning ladda ner base64-bilderna i varje meddelande — dyrt och helt i onödan.
 */
async function* scan(collectionGroup, fields, pageSize = 400) {
  let cursor = null;
  for (;;) {
    let q = db.collectionGroup(collectionGroup).select(...fields).orderBy('__name__').limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) return;
    for (const doc of snap.docs) yield doc;
    if (snap.size < pageSize) return;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

class Batcher {
  constructor() {
    this.batch = db.batch();
    this.count = 0;
    this.written = 0;
  }
  async add(fn) {
    if (DRY_RUN) return;
    fn(this.batch);
    this.written += 1;
    if ((this.count += 1) >= 400) await this.flush();
  }
  async flush() {
    if (DRY_RUN || this.count === 0) return;
    await this.batch.commit();
    this.batch = db.batch();
    this.count = 0;
  }
}

const stats = {};
const bump = (key, n = 1) => { stats[key] = (stats[key] || 0) + n; };

/** Steg 1: plocka bort bilderna men behåll texten. */
async function stripImages() {
  const batcher = new Batcher();

  for await (const doc of scan('messages', ['timestamp', 'attachments', 'generatedImage'])) {
    const data = doc.data();
    const age = ageInDays(data, ['timestamp']);
    if (age === null) { bump('meddelanden utan tidsstämpel'); continue; }
    if (age < IMAGE_DAYS) continue;
    const hasImages = Array.isArray(data.attachments) ? data.attachments.length > 0 : false;
    if (!hasImages && !data.generatedImage) continue;
    bump('meddelanden avbildade');
    await batcher.add((b) =>
      b.update(doc.ref, {
        attachments: FieldValue.delete(),
        generatedImage: FieldValue.delete(),
        imagesRemovedAt: FieldValue.serverTimestamp(),
      }),
    );
  }

  for await (const doc of scan('tasks', ['createdAt', 'imageUrl', 'imageUrls'])) {
    const data = doc.data();
    const age = ageInDays(data, ['createdAt']);
    if (age === null) { bump('uppgifter utan tidsstämpel'); continue; }
    if (age < IMAGE_DAYS) continue;
    if (!data.imageUrl && !(data.imageUrls?.length > 0)) continue;
    bump('uppgifter avbildade');
    await batcher.add((b) =>
      b.update(doc.ref, {
        imageUrl: FieldValue.delete(),
        imageUrls: FieldValue.delete(),
        imagesRemovedAt: FieldValue.serverTimestamp(),
      }),
    );
  }

  await batcher.flush();
}

/** Steg 2: radera det som passerat sin fulla lagringstid. */
async function deleteExpired() {
  const batcher = new Batcher();

  for await (const doc of scan('messages', ['timestamp'])) {
    const age = ageInDays(doc.data(), ['timestamp']);
    if (age === null || age < MESSAGE_DAYS) continue;
    bump('meddelanden raderade');
    await batcher.add((b) => b.delete(doc.ref));
  }

  for await (const doc of scan('tasks', ['createdAt'])) {
    const age = ageInDays(doc.data(), ['createdAt']);
    if (age === null || age < TASK_DAYS) continue;
    bump('uppgifter raderade');
    await batcher.add((b) => b.delete(doc.ref));
  }

  await batcher.flush();

  // Sessionerna sist och var för sig: en session raderas bara när den både är
  // gammal nog och tömd på meddelanden, annars skulle steget ovan kunna lämna
  // meddelanden utan förälder — precis den sortens föräldralösa dokument som
  // gjorde att "rensa chatt" lämnade data kvar i databasen.
  const sessionBatcher = new Batcher();
  for await (const doc of scan('chatSessions', ['createdAt'])) {
    const age = ageInDays(doc.data(), ['createdAt']);
    if (age === null || age < SESSION_DAYS) continue;
    const remaining = await doc.ref.collection('messages').limit(1).get();
    if (!remaining.empty) continue;
    bump('sessioner raderade');
    await sessionBatcher.add((b) => b.delete(doc.ref));
  }
  await sessionBatcher.flush();
}

async function main() {
  console.log(`Projekt: ${PROJECT_ID}`);
  console.log(`Gallring: bilder ${IMAGE_DAYS} d, meddelanden ${MESSAGE_DAYS} d, ` +
              `uppgifter ${TASK_DAYS} d, sessioner ${SESSION_DAYS} d`);
  console.log(DRY_RUN ? 'Läge: TESTKÖRNING — inget skrivs\n' : 'Läge: skarpt\n');

  await stripImages();
  await deleteExpired();

  const rows = Object.entries(stats);
  if (rows.length === 0) {
    console.log('Inget att gallra.');
  } else {
    for (const [label, n] of rows.sort()) console.log(`  ${String(n).padStart(6)}  ${label}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    const body = rows.length
      ? rows.sort().map(([l, n]) => `- ${l}: **${n}**`).join('\n')
      : '- Inget att gallra.';
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Gallring${DRY_RUN ? ' (testkörning)' : ''}\n\n${body}\n`,
    );
  }
}

main().catch((err) => {
  console.error('Gallringen misslyckades:', err);
  process.exit(1);
});
