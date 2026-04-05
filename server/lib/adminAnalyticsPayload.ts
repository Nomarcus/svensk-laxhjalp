import type { Firestore } from 'firebase-admin/firestore';
import {
  ADMIN_MAX_CHILDREN_PER_USER,
  aggregateUsageForRangeDetailed,
  listUserChildRefs,
} from './adminOverviewPayload';
import { firestoreDocTimeMs } from './firestoreDocTime';

const EMAIL_GET_CHUNK = 15;

async function loadUserEmails(db: Firestore, uids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (let i = 0; i < uids.length; i += EMAIL_GET_CHUNK) {
    const chunk = uids.slice(i, i + EMAIL_GET_CHUNK);
    if (chunk.length === 0) continue;
    const snaps = await db.getAll(...chunk.map((uid) => db.doc(`users/${uid}`)));
    snaps.forEach((snap, j) => {
      const uid = chunk[j]!;
      if (!snap.exists) {
        out.set(uid, null);
        return;
      }
      const row = snap.data() || {};
      const email = typeof row.email === 'string' ? row.email : null;
      out.set(uid, email);
    });
  }
  return out;
}

const MAX_ANALYTICS_USERS = 120;
const USER_PARALLEL = 2;
/** Undvik enorma läsningar om något konto har väldigt mycket data. */
const MAX_DOCS_PER_CHILD_COLLECTION = 2500;

export type AnalyticsPreset = 'day' | 'week' | 'month' | 'year' | 'all';

function ymdUTC(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export function boundsForAnalyticsPreset(preset: AnalyticsPreset): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfUtcDay(now);
  const start = new Date(now);
  if (preset === 'day') {
    start.setTime(startOfUtcDay(now).getTime());
  } else if (preset === 'week') {
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
  } else if (preset === 'month') {
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
  } else if (preset === 'year') {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    start.setUTCHours(0, 0, 0, 0);
  } else {
    start.setTime(Date.UTC(2022, 0, 1));
  }
  return { start, end };
}

function enumerateDatesUTC(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cur.getTime() <= last.getTime()) {
    out.push(ymdUTC(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** För långa perioder: begränsa usage-graf till sista 90 dagarna (färre Firestore-läsningar). */
function usageChartDates(start: Date, end: Date): { dates: string[]; truncated: boolean } {
  const all = enumerateDatesUTC(start, end);
  if (all.length <= 45) return { dates: all, truncated: false };
  return { dates: all.slice(-90), truncated: true };
}

function normSubjectKey(raw: string): string {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, ' ') || 'okänt';
}

type SubjectAcc = {
  key: string;
  display: string;
  taskCount: number;
  libraryCount: number;
  tasksCompleted: number;
  tasksIncomplete: number;
  withPhoto: number;
  withLinkedChat: number;
  withAiNotes: number;
  examTasks: number;
  withExamPrep: number;
  progressSum: number;
  progressN: number;
};

export async function buildAdminAnalyticsPayload(db: Firestore, presetRaw: string) {
  const preset = (['day', 'week', 'month', 'year', 'all'].includes(presetRaw)
    ? presetRaw
    : 'month') as AnalyticsPreset;

  const { start, end } = boundsForAnalyticsPreset(preset);

  const usersSnap = await db.collection('users').select().get();
  const userIds = usersSnap.docs.map((d) => d.id).slice(0, MAX_ANALYTICS_USERS);

  const subjects = new Map<string, SubjectAcc>();

  function ensureSubject(raw: string): SubjectAcc {
    const key = normSubjectKey(raw);
    const display = (raw || '').trim() || 'Okänt';
    let b = subjects.get(key);
    if (!b) {
      b = {
        key,
        display,
        taskCount: 0,
        libraryCount: 0,
        tasksCompleted: 0,
        tasksIncomplete: 0,
        withPhoto: 0,
        withLinkedChat: 0,
        withAiNotes: 0,
        examTasks: 0,
        withExamPrep: 0,
        progressSum: 0,
        progressN: 0,
      };
      subjects.set(key, b);
    }
    return b;
  }

  function addLibrarySubject(raw: string) {
    const b = ensureSubject(raw);
    b.libraryCount += 1;
    const d = (raw || '').trim() || 'Allmänt';
    if (d.length > b.display.length || b.display === 'Okänt') b.display = d;
  }

  let tasksInRange = 0;
  let chatSessionsInRange = 0;
  let libraryInRange = 0;
  let stalledIncomplete = 0;
  let gPhoto = 0;
  let gLinked = 0;
  let gAiNotes = 0;
  let gExam = 0;
  let gExamPrep = 0;

  async function processUser(uid: string) {
    try {
      const { refs: childRefs } = await listUserChildRefs(db, uid);
      for (const cref of childRefs) {
        const [tasksSnap, libSnap, sessSnap] = await Promise.all([
          cref.collection('tasks').limit(MAX_DOCS_PER_CHILD_COLLECTION).get(),
          cref.collection('library').limit(MAX_DOCS_PER_CHILD_COLLECTION).get(),
          cref.collection('chatSessions').limit(MAX_DOCS_PER_CHILD_COLLECTION).get(),
        ]);

      for (const doc of tasksSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = firestoreDocTimeMs(r, 'createdAt');
        if (t != null && t < start.getTime() && r.completed !== true) {
          stalledIncomplete += 1;
        }
      }

      for (const doc of tasksSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = firestoreDocTimeMs(r, 'createdAt');
        if (t == null || t < start.getTime() || t > end.getTime()) continue;

        tasksInRange += 1;
        const subj = typeof r.subject === 'string' ? r.subject : 'Okänt';
        const b = ensureSubject(subj);
        if (b.display === 'Okänt' || subj.trim()) b.display = subj.trim() || b.display;

        b.taskCount += 1;
        if (r.completed === true) {
          b.tasksCompleted += 1;
        } else {
          b.tasksIncomplete += 1;
        }

        const hasPhoto = Boolean(r.imageUrl) || (Array.isArray(r.imageUrls) && r.imageUrls.length > 0);
        if (hasPhoto) {
          b.withPhoto += 1;
          gPhoto += 1;
        }
        if (r.linkedChatSessionId) {
          b.withLinkedChat += 1;
          gLinked += 1;
        }
        if (Array.isArray(r.aiNotes) && r.aiNotes.length > 0) {
          b.withAiNotes += 1;
          gAiNotes += 1;
        }
        if (r.taskType === 'exam') {
          b.examTasks += 1;
          gExam += 1;
        }
        if (typeof r.examPrepContent === 'string' && r.examPrepContent.trim().length > 0) {
          b.withExamPrep += 1;
          gExamPrep += 1;
        }
        const pp = r.progressPercent;
        if (typeof pp === 'number' && !Number.isNaN(pp)) {
          b.progressSum += pp;
          b.progressN += 1;
        }
      }

      for (const doc of libSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = firestoreDocTimeMs(r, 'createdAt');
        if (t == null || t < start.getTime() || t > end.getTime()) continue;
        libraryInRange += 1;
        const subj = typeof r.subject === 'string' ? r.subject : 'Allmänt';
        addLibrarySubject(subj);
      }

      for (const doc of sessSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = firestoreDocTimeMs(r, 'createdAt');
        if (t == null || t < start.getTime() || t > end.getTime()) continue;
        chatSessionsInRange += 1;
      }
    }
    } catch (err) {
      console.error('admin analytics processUser:', uid, err instanceof Error ? err.message : err);
    }
  }

  for (let i = 0; i < userIds.length; i += USER_PARALLEL) {
    const slice = userIds.slice(i, i + USER_PARALLEL);
    await Promise.all(slice.map((uid) => processUser(uid)));
  }

  const { dates: usageDates, truncated: usageChartTruncated } = usageChartDates(start, end);
  let usageByDay: { date: string; aiChats: number; imageAnalyses: number }[] = [];
  let usageSumAi = 0;
  let usageSumImg = 0;
  let usageSumTts = 0;
  let usageLeaders: {
    uid: string;
    email: string | null;
    aiChats: number;
    imageAnalyses: number;
    premiumTts: number;
  }[] = [];
  let usageFailed = false;

  try {
    const detailed = await aggregateUsageForRangeDetailed(db, usageDates, userIds);
    usageByDay = detailed.byDay.map((d) => ({
      date: d.date,
      aiChats: d.aiChats,
      imageAnalyses: d.imageAnalyses,
    }));
    usageSumAi = detailed.sumAiChats;
    usageSumImg = detailed.sumImageAnalyses;
    usageSumTts = detailed.sumAiTts;
    const emails = await loadUserEmails(
      db,
      detailed.leaders.map((l) => l.uid),
    );
    usageLeaders = detailed.leaders.map((l) => ({
      uid: l.uid,
      email: emails.get(l.uid) ?? null,
      aiChats: l.aiChats,
      imageAnalyses: l.imageAnalyses,
      premiumTts: l.aiTtsCount,
    }));
  } catch (e) {
    usageFailed = true;
    console.error('admin analytics usage:', e);
  }

  const subjectRows = Array.from(subjects.values())
    .map((b) => {
      const totalMentions = b.taskCount + b.libraryCount;
      const completionRate = b.taskCount > 0 ? b.tasksCompleted / b.taskCount : null;
      const avgProgress = b.progressN > 0 ? Math.round(b.progressSum / b.progressN) : null;
      return {
        key: b.key,
        display: b.display,
        taskCount: b.taskCount,
        libraryCount: b.libraryCount,
        totalMentions,
        tasksCompleted: b.tasksCompleted,
        tasksIncomplete: b.tasksIncomplete,
        completionRate,
        avgProgress,
        withPhoto: b.withPhoto,
        withLinkedChat: b.withLinkedChat,
        withAiNotes: b.withAiNotes,
        examTasks: b.examTasks,
        withExamPrep: b.withExamPrep,
      };
    })
    .sort((a, b) => b.totalMentions - a.totalMentions)
    .slice(0, 50);

  const subjectsStruggling = subjectRows
    .filter((s) => s.taskCount >= 3 && s.completionRate != null && s.completionRate < 0.45)
    .sort((a, b) => (a.completionRate ?? 1) - (b.completionRate ?? 1))
    .slice(0, 15);

  const subjectsLowProgress = subjectRows
    .filter((s) => s.avgProgress != null && s.taskCount >= 2 && s.avgProgress < 40)
    .sort((a, b) => (a.avgProgress ?? 100) - (b.avgProgress ?? 100))
    .slice(0, 10);

  const featureCandidates = [
    { id: 'usage_ai_chats', count: usageSumAi },
    { id: 'usage_image_analysis', count: usageSumImg },
    { id: 'usage_premium_tts', count: usageSumTts },
    { id: 'planner_tasks_new', count: tasksInRange },
    { id: 'chat_sessions_new', count: chatSessionsInRange },
    { id: 'library_saves', count: libraryInRange },
    { id: 'tasks_with_photo', count: gPhoto },
    { id: 'tasks_linked_chat', count: gLinked },
    { id: 'tasks_with_ai_notes', count: gAiNotes },
    { id: 'exam_tasks', count: gExam },
    { id: 'exam_prep_generated', count: gExamPrep },
  ].sort((a, b) => b.count - a.count);

  const featuresMost = featureCandidates.slice(0, 6);
  const featuresLeast = [...featureCandidates].reverse().filter((f) => f.count > 0).slice(0, 5);

  const notes: string[] = [
    'Översikten (ovanför) visar totala chatt-sessioner utan tidsfilter. Här räknas "nya chatt-sessioner" bara om dokumentets createdAt ligger inom vald period (UTC). Vid tvekan, välj "Sedan 2022" eller "12 mån".',
    'Servern loggar AI-chatt, bildanalys och premium-TTS (endast free) i users/{uid}/usage/{YYYY-MM-DD} vid varje lyckat anrop — även när abonnemangsgränser är av.',
    'Uppgifter räknas om de har createdAt inom perioden (ISO-sträng eller Firestore-tid). Äldre uppgifter utan datum syns inte i periodfilter.',
    'Ämnesfördelning: planeringsuppgifter + biblioteksposter (ämnesfält).',
    'Låg slutförandegrad och låg självrapporterad progress tolkas som möjliga "svåra" områden — inte samma sak som användarfeedback.',
  ];
  if (usageChartTruncated) {
    notes.push('AI-grafen visar högst de senaste 90 UTC-dagarna när perioden är längre (färre Firestore-läsningar). Summan följer samma fönster.');
  }
  if (usageFailed) {
    notes.push('Usage-serien kunde inte hämtas — se serverloggar.');
  }
  if (usersSnap.size > MAX_ANALYTICS_USERS) {
    notes.push(`Analysen begränsas till ${MAX_ANALYTICS_USERS} användare (id-ordning) av ${usersSnap.size} totalt.`);
  }
  notes.push(
    `Högst ${ADMIN_MAX_CHILDREN_PER_USER} barnprofiler per användare ingår i analysen (query istället för listDocuments).`,
  );
  notes.push(
    `Högst ${MAX_DOCS_PER_CHILD_COLLECTION} dokument per barn och underkollektion (tasks/library/chatSessions) räknas — vid extremt mycket data är siffror ett urval.`,
  );

  return {
    preset,
    generatedAt: new Date().toISOString(),
    range: { startUtc: start.toISOString(), endUtc: end.toISOString() },
    sampledUsers: userIds.length,
    usersTotal: usersSnap.size,
    usageChartTruncated,
    usageFailed,
    totals: {
      tasksCreated: tasksInRange,
      chatSessionsCreated: chatSessionsInRange,
      libraryItemsAdded: libraryInRange,
      incompleteTasksOlderThanRange: stalledIncomplete,
    },
    usage: {
      sumAiChats: usageSumAi,
      sumImageAnalyses: usageSumImg,
      sumPremiumTts: usageSumTts,
      byDay: usageByDay,
    },
    usageLeaders,
    subjects: subjectRows,
    difficulty: {
      lowCompletionSubjects: subjectsStruggling,
      lowAvgProgressSubjects: subjectsLowProgress,
    },
    features: {
      most: featuresMost,
      least: featuresLeast,
    },
    notes,
  };
}
