import type { Firestore } from 'firebase-admin/firestore';

const MAX_USERS_SAMPLE = 2500;
/** Firestore batch limit for getAll. */
const USAGE_GET_CHUNK = 100;

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

/** Per-user usage docs — avoids collectionGroup + documentId indexes that often break admin. */
async function aggregateUsageForDateByUsers(db: Firestore, dateStr: string, userIds: string[]) {
  let aiChats = 0;
  let imageAnalyses = 0;
  const perUser: { uid: string; aiChats: number; imageAnalyses: number }[] = [];

  for (let i = 0; i < userIds.length; i += USAGE_GET_CHUNK) {
    const chunk = userIds.slice(i, i + USAGE_GET_CHUNK);
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

/** Shared by Express (Cloud Run) and Vercel serverless. */
export async function buildAdminOverviewPayload(db: Firestore) {
  const dates = lastNDatesUTC(14);
  const today = dates[dates.length - 1]!;

  const userIdsSnap = await db.collection('users').select().get();
  const userIds = userIdsSnap.docs.map((d) => d.id);
  const totalUsersCounted = userIds.length;

  const [childrenCountSnap, chatSessionsSnap, tasksSnap, librarySnap, usersSample, ...dailyUsage] = await Promise.all([
    db.collectionGroup('children').count().get(),
    db.collectionGroup('chatSessions').count().get(),
    db.collectionGroup('tasks').count().get(),
    db.collectionGroup('library').count().get(),
    db
      .collection('users')
      .select('email', 'displayName', 'tier', 'subscriptionStatus', 'lastLogin', 'uid')
      .limit(MAX_USERS_SAMPLE)
      .get(),
    ...dates.map((d) => aggregateUsageForDateByUsers(db, d, userIds)),
  ]);
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

  const todayBundle = dailyUsage[dailyUsage.length - 1]!;
  const topToday = todayBundle.topUsers.map((row) => ({
    uid: row.uid,
    email: emailByUid.get(row.uid) ?? null,
    aiChats: row.aiChats,
    imageAnalyses: row.imageAnalyses,
  }));

  const dailySeries = dates.map((d, i) => ({
    date: d,
    aiChats: dailyUsage[i]!.aiChats,
    imageAnalyses: dailyUsage[i]!.imageAnalyses,
    activeUsers: dailyUsage[i]!.activeUsers,
  }));

  const insights: string[] = [];
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
      children: childrenCountSnap.data().count,
      chatSessions: chatSessionsSnap.data().count,
      tasks: tasksSnap.data().count,
      libraryItems: librarySnap.data().count,
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
