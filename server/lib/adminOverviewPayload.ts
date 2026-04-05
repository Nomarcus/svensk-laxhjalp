import type { CollectionReference, Firestore, QuerySnapshot } from 'firebase-admin/firestore';
import { resolveFirestoreDatabaseId } from './serverFirestore';

const MAX_USERS_SAMPLE = 2500;
/** keep getAll batches small (Cloud Run + Firestore client pool ~100 concurrent ops). */
const USAGE_GET_CHUNK = 15;
/** Few users in parallel; each user processes children one-by-one to avoid burst. */
const TOTALS_USER_PARALLEL = 3;
/** Samma tak som admin analytics; undvik count()-aggregate som kan fallera på vissa Firestore-DB. */
const TOTALS_MAX_DOCS_PER_SUBCOL = 2500;
/** Run usage-by-day in small waves to reduce Firestore burst + timeouts. */
const USAGE_DAY_PARALLEL = 2;

export function isSoleAdminFromEnv(uid: string | undefined, email: string | undefined): boolean {
  const adminUid = process.env.ADMIN_UID?.trim();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (adminUid) {
    if (!uid || uid !== adminUid) return false;
    if (adminEmail && (!email || email.toLowerCase() !== adminEmail)) return false;
    return true;
  }

  if (adminEmail) {
    return Boolean(email && email.toLowerCase() === adminEmail);
  }

  return false;
}

function ymdUTC(d: Date): string {
  return d.toISOString().split('T')[0];
}

function lastNDatesUTC(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(ymdUTC(d));
  }
  return out;
}

function tsToDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v as { toDate?: () => Date };
  if (typeof d.toDate === 'function') return d.toDate();
  return null;
}

export async function aggregateUsageForDateByUsers(db: Firestore, dateStr: string, userIds: string[]) {
  let aiChats = 0;
  let imageAnalyses = 0;
  const perUser: { uid: string; aiChats: number; imageAnalyses: number }[] = [];

  if (userIds.length === 0) {
    return { aiChats: 0, imageAnalyses: 0, activeUsers: 0, topUsers: [] };
  }

  for (let i = 0; i < userIds.length; i += USAGE_GET_CHUNK) {
    const chunk = userIds.slice(i, i + USAGE_GET_CHUNK);
    if (chunk.length === 0) continue;
    const refs = chunk.map((uid) => db.doc(`users/${uid}/usage/${dateStr}`));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, j) => {
      if (!snap.exists) return;
      const uid = chunk[j]!;
      const row = snap.data() || {};
      const c = typeof row.chatCount === 'number' ? row.chatCount : 0;
      const im = typeof row.imageCount === 'number' ? row.imageCount : 0;
      aiChats += c;
      imageAnalyses += im;
      if (c > 0 || im > 0) perUser.push({ uid, aiChats: c, imageAnalyses: im });
    });
  }

  perUser.sort((a, b) => b.aiChats + b.imageAnalyses - (a.aiChats + a.imageAnalyses));
  return {
    aiChats,
    imageAnalyses,
    activeUsers: perUser.length,
    topUsers: perUser.slice(0, 25),
  };
}

export async function aggregateUsageByDays(db: Firestore, dates: string[], userIds: string[]) {
  const out: Awaited<ReturnType<typeof aggregateUsageForDateByUsers>>[] = [];
  if (dates.length === 0) return out;
  for (let i = 0; i < dates.length; i += USAGE_DAY_PARALLEL) {
    const slice = dates.slice(i, i + USAGE_DAY_PARALLEL);
    const batch = await Promise.all(slice.map((d) => aggregateUsageForDateByUsers(db, d, userIds)));
    out.push(...batch);
  }
  return out;
}

/** En Firestore-pass: dagliga totals, summor och topplista (samma datumfönster som AI-grafen). */
export async function aggregateUsageForRangeDetailed(
  db: Firestore,
  dates: string[],
  userIds: string[],
): Promise<{
  byDay: { date: string; aiChats: number; imageAnalyses: number; aiTtsCount: number }[];
  sumAiChats: number;
  sumImageAnalyses: number;
  sumAiTts: number;
  leaders: { uid: string; aiChats: number; imageAnalyses: number; aiTtsCount: number }[];
}> {
  const perUser = new Map<string, { aiChats: number; imageAnalyses: number; aiTtsCount: number }>();
  for (const uid of userIds) {
    perUser.set(uid, { aiChats: 0, imageAnalyses: 0, aiTtsCount: 0 });
  }

  const byDay: { date: string; aiChats: number; imageAnalyses: number; aiTtsCount: number }[] = [];
  let sumAiChats = 0;
  let sumImageAnalyses = 0;
  let sumAiTts = 0;

  if (dates.length === 0 || userIds.length === 0) {
    return { byDay, sumAiChats, sumImageAnalyses, sumAiTts, leaders: [] };
  }

  for (let di = 0; di < dates.length; di += USAGE_DAY_PARALLEL) {
    const slice = dates.slice(di, di + USAGE_DAY_PARALLEL);
    const parts = await Promise.all(
      slice.map(async (dateStr) => {
        let dayAi = 0;
        let dayImg = 0;
        let dayTts = 0;
        for (let i = 0; i < userIds.length; i += USAGE_GET_CHUNK) {
          const chunk = userIds.slice(i, i + USAGE_GET_CHUNK);
          if (chunk.length === 0) continue;
          const refs = chunk.map((uid) => db.doc(`users/${uid}/usage/${dateStr}`));
          const snaps = await db.getAll(...refs);
          snaps.forEach((snap, j) => {
            if (!snap.exists) return;
            const uid = chunk[j]!;
            const row = snap.data() || {};
            const c = typeof row.chatCount === 'number' ? row.chatCount : 0;
            const im = typeof row.imageCount === 'number' ? row.imageCount : 0;
            const tts = typeof row.aiTtsCount === 'number' ? row.aiTtsCount : 0;
            dayAi += c;
            dayImg += im;
            dayTts += tts;
            const p = perUser.get(uid);
            if (p) {
              p.aiChats += c;
              p.imageAnalyses += im;
              p.aiTtsCount += tts;
            }
          });
        }
        return { dateStr, dayAi, dayImg, dayTts };
      }),
    );

    for (const p of parts) {
      byDay.push({
        date: p.dateStr,
        aiChats: p.dayAi,
        imageAnalyses: p.dayImg,
        aiTtsCount: p.dayTts,
      });
      sumAiChats += p.dayAi;
      sumImageAnalyses += p.dayImg;
      sumAiTts += p.dayTts;
    }
  }

  const leaders = [...perUser.entries()]
    .map(([uid, v]) => ({
      uid,
      aiChats: v.aiChats,
      imageAnalyses: v.imageAnalyses,
      aiTtsCount: v.aiTtsCount,
    }))
    .filter((x) => x.aiChats + x.imageAnalyses + x.aiTtsCount > 0)
    .sort(
      (a, b) =>
        b.aiChats + b.imageAnalyses + b.aiTtsCount - (a.aiChats + a.imageAnalyses + a.aiTtsCount),
    )
    .slice(0, 20);

  return { byDay, sumAiChats, sumImageAnalyses, sumAiTts, leaders };
}

function snapshotBoundedCount(snap: QuerySnapshot, cap: number): { n: number; capped: boolean } {
  const size = snap.size;
  if (size <= cap) return { n: size, capped: false };
  return { n: cap, capped: true };
}

/**
 * Räkna dokument utan count()-aggregate. Använder createdAt-projektion (lätt); fallback om Firestore klagar.
 */
async function boundedSubcollectionCount(col: CollectionReference): Promise<{ n: number; capped: boolean }> {
  const cap = TOTALS_MAX_DOCS_PER_SUBCOL;
  try {
    const snap = await col.select('createdAt').limit(cap + 1).get();
    return snapshotBoundedCount(snap, cap);
  } catch (e) {
    console.warn('admin totals: select(createdAt) failed, using full limit().get()', e);
    const snap = await col.limit(cap + 1).get();
    return snapshotBoundedCount(snap, cap);
  }
}

/**
 * Sum children / chatSessions / tasks / library by walking each user's `children` subcollection.
 */
async function aggregateTotalsByUserTree(db: Firestore, userIds: string[]) {
  let children = 0;
  let chatSessions = 0;
  let tasks = 0;
  let libraryItems = 0;
  let totalsCapped = false;
  let uidErrors = 0;

  for (let i = 0; i < userIds.length; i += TOTALS_USER_PARALLEL) {
    const slice = userIds.slice(i, i + TOTALS_USER_PARALLEL);
    const parts = await Promise.all(
      slice.map(async (uid) => {
        try {
          const childRefs = await db.collection('users').doc(uid).collection('children').listDocuments();
          let cs = 0;
          let tk = 0;
          let lib = 0;
          let userCapped = false;
          for (const cref of childRefs) {
            const [a, b, c] = await Promise.all([
              boundedSubcollectionCount(cref.collection('chatSessions')),
              boundedSubcollectionCount(cref.collection('tasks')),
              boundedSubcollectionCount(cref.collection('library')),
            ]);
            if (a.capped || b.capped || c.capped) userCapped = true;
            cs += a.n;
            tk += b.n;
            lib += c.n;
          }
          return {
            children: childRefs.length,
            chatSessions: cs,
            tasks: tk,
            libraryItems: lib,
            capped: userCapped,
            ok: true as const,
          };
        } catch (err) {
          console.error('admin aggregateTotalsByUserTree uid=', uid, err);
          return {
            children: 0,
            chatSessions: 0,
            tasks: 0,
            libraryItems: 0,
            capped: false,
            ok: false as const,
          };
        }
      }),
    );
    for (const p of parts) {
      if (!p.ok) {
        uidErrors += 1;
        continue;
      }
      children += p.children;
      chatSessions += p.chatSessions;
      tasks += p.tasks;
      libraryItems += p.libraryItems;
      if (p.capped) totalsCapped = true;
    }
  }

  return { children, chatSessions, tasks, libraryItems, totalsCapped, totalsUidErrors: uidErrors };
}

function emptyDailyUsageRow() {
  return {
    aiChats: 0,
    imageAnalyses: 0,
    activeUsers: 0,
    topUsers: [] as { uid: string; aiChats: number; imageAnalyses: number }[],
  };
}

/** Shared by Express (Cloud Run) and Vercel serverless. */
export async function buildAdminOverviewPayload(db: Firestore) {
  const dates = lastNDatesUTC(14);
  const today = dates[dates.length - 1]!;

  const [userIdsSnap, usersSample] = await Promise.all([
    db.collection('users').select().get(),
    db
      .collection('users')
      .select('email', 'displayName', 'tier', 'subscriptionStatus', 'lastLogin', 'uid')
      .limit(MAX_USERS_SAMPLE)
      .get(),
  ]);

  const userIds = userIdsSnap.docs.map((d) => d.id);
  const totalUsersCounted = userIds.length;

  let totalsResolved = {
    children: 0,
    chatSessions: 0,
    tasks: 0,
    libraryItems: 0,
    totalsCapped: false,
    totalsUidErrors: 0,
  };
  let dailyUsageResolved: Awaited<ReturnType<typeof aggregateUsageByDays>> = dates.map(() => emptyDailyUsageRow());
  let totalsFailed = false;
  let usageFailed = false;

  await Promise.all([
    (async () => {
      try {
        totalsResolved = await aggregateTotalsByUserTree(db, userIds);
      } catch (err) {
        totalsFailed = true;
        console.error('admin aggregateTotalsByUserTree:', err);
      }
    })(),
    (async () => {
      try {
        dailyUsageResolved = await aggregateUsageByDays(db, dates, userIds);
      } catch (err) {
        usageFailed = true;
        console.error('admin aggregateUsageByDays:', err);
      }
    })(),
  ]);

  const { children, chatSessions, tasks, libraryItems, totalsCapped, totalsUidErrors } = totalsResolved;

  const userDocs = usersSample.docs;
  type Tier = string;
  const tierBuckets: Record<string, number> = {};
  const statusBuckets: Record<string, number> = {};
  let withEmail = 0;
  let guests = 0;
  let activeLast7d = 0;
  const sevenAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const recentRows: {
    uid: string;
    email: string | null;
    displayName: string | null;
    tier: Tier;
    subscriptionStatus: string;
    lastLogin: string | null;
  }[] = [];

  const emailByUid = new Map<string, string | null>();

  userDocs.forEach((doc) => {
    const uid = doc.id;
    const u = doc.data();
    const tier = (u.tier as string) || 'free';
    const st = (u.subscriptionStatus as string) || 'none';
    tierBuckets[tier] = (tierBuckets[tier] || 0) + 1;
    statusBuckets[st] = (statusBuckets[st] || 0) + 1;

    const em = typeof u.email === 'string' ? u.email : null;
    emailByUid.set(uid, em);
    if (em) withEmail += 1;
    else guests += 1;

    const login = tsToDate(u.lastLogin);
    if (login && login.getTime() >= sevenAgo) activeLast7d += 1;

    recentRows.push({
      uid,
      email: em,
      displayName: typeof u.displayName === 'string' ? u.displayName : null,
      tier,
      subscriptionStatus: st,
      lastLogin: login ? login.toISOString() : null,
    });
  });

  recentRows.sort((a, b) => {
    const ta = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
    const tb = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
    return tb - ta;
  });

  const todayBundle = dailyUsageResolved[dailyUsageResolved.length - 1]!;
  const topToday = todayBundle.topUsers.map((row) => ({
    uid: row.uid,
    email: emailByUid.get(row.uid) ?? null,
    aiChats: row.aiChats,
    imageAnalyses: row.imageAnalyses,
  }));

  const dailySeries = dates.map((d, i) => ({
    date: d,
    aiChats: dailyUsageResolved[i]!.aiChats,
    imageAnalyses: dailyUsageResolved[i]!.imageAnalyses,
    activeUsers: dailyUsageResolved[i]!.activeUsers,
  }));

  const insights: string[] = [];
  const fsDbId = resolveFirestoreDatabaseId();
  insights.push(
    `firestore: serverläser databas "${fsDbId ?? '(default)'}" — ska matcha klientens firestoreDatabaseId i firebase-applet-config. Om barn/chatt är 0 men syns i konsolen: sätt FIRESTORE_DATABASE_ID på Cloud Run eller deploya om med senaste deploy:api.`,
  );
  insights.push(
    'totals: users/children tree with throttled Firestore calls (avoids collectionGroup + client overload).',
  );
  if (totalsFailed) {
    insights.push(
      'totals failed server-side — see Cloud Run / Vercel logs. Om du kör foraldrahjalpen.se: deploya om API med npm run deploy:api (Hosting skickar /api till Cloud Run).',
    );
  }
  if (!totalsFailed && totalsCapped) {
    insights.push(
      `totals: minst en barn-underkollektion har fler än ${TOTALS_MAX_DOCS_PER_SUBCOL} dokument — översiktssiffror är avkapade till det taket (samma som analytics).`,
    );
  }
  if (!totalsFailed && totalsUidErrors > 0) {
    insights.push(
      `totals: ${totalsUidErrors} användare kunde inte räknas (se Cloud Run-loggar). Övriga ingår i siffrorna.`,
    );
  }
  if (usageFailed) {
    insights.push('usage (14 dagar) misslyckades — kontrollera serverloggar.');
  }
  if (userDocs.length >= MAX_USERS_SAMPLE || totalUsersCounted > userDocs.length) {
    insights.push(
      `sampling: tier/login stats use up to ${MAX_USERS_SAMPLE} user documents; Firestore reports ${totalUsersCounted} users total.`,
    );
  }
  const freeShare = tierBuckets['free'] ?? 0;
  if (userDocs.length > 0) {
    const pct = Math.round((freeShare / userDocs.length) * 100);
    insights.push(`subscriptions: about ${pct}% of sampled accounts are on the free tier.`);
  }
  if (todayBundle.aiChats === 0 && todayBundle.imageAnalyses === 0) {
    insights.push('today: no AI chat or image usage recorded yet (UTC day).');
  }
  if (activeLast7d === 0 && totalUsersCounted > 5) {
    insights.push('engagement: no sampled users with lastLogin in the last 7 days — verify lastLogin writes.');
  }

  return {
    generatedAt: new Date().toISOString(),
    config: {
      soleAdminConfigured: Boolean(process.env.ADMIN_UID?.trim() || process.env.ADMIN_EMAIL?.trim()),
      usersSampled: userDocs.length,
      usersTotal: totalUsersCounted,
      cappedSample: userDocs.length >= MAX_USERS_SAMPLE || totalUsersCounted > userDocs.length,
    },
    totals: {
      users: totalUsersCounted,
      children,
      chatSessions,
      tasks,
      libraryItems,
    },
    engagement: { withEmail, guests, activeLast7DaysInSample: activeLast7d },
    subscription: { byTier: tierBuckets, byStatus: statusBuckets },
    usage: {
      todayUtc: today,
      today: {
        aiChats: todayBundle.aiChats,
        imageAnalyses: todayBundle.imageAnalyses,
        activeUsers: todayBundle.activeUsers,
      },
      last14Days: dailySeries,
    },
    recentUsers: recentRows.slice(0, 40),
    topUsersToday: topToday,
    insights,
  };
}
