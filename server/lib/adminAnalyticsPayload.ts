import type { Firestore } from 'firebase-admin/firestore';
import { aggregateUsageByDays } from './adminOverviewPayload';

const MAX_ANALYTICS_USERS = 300;
const USER_PARALLEL = 3;

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

function tsToDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v as { toDate?: () => Date };
  if (typeof d.toDate === 'function') return d.toDate();
  return null;
}

function docTimeMs(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  const d = tsToDate(v);
  return d ? d.getTime() : null;
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
    const childRefs = await db.collection('users').doc(uid).collection('children').listDocuments();
    for (const cref of childRefs) {
      const [tasksSnap, libSnap, sessSnap] = await Promise.all([
        cref
          .collection('tasks')
          .select(
            'subject',
            'createdAt',
            'completed',
            'taskType',
            'imageUrl',
            'imageUrls',
            'linkedChatSessionId',
            'aiNotes',
            'examPrepContent',
            'progressPercent',
          )
          .get(),
        cref.collection('library').select('subject', 'createdAt').get(),
        cref.collection('chatSessions').select('createdAt').get(),
      ]);

      for (const doc of tasksSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = docTimeMs(r, 'createdAt');
        if (t != null && t < start.getTime() && r.completed !== true) {
          stalledIncomplete += 1;
        }
      }

      for (const doc of tasksSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = docTimeMs(r, 'createdAt');
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
        const t = docTimeMs(r, 'createdAt');
        if (t == null || t < start.getTime() || t > end.getTime()) continue;
        libraryInRange += 1;
        const subj = typeof r.subject === 'string' ? r.subject : 'Allmänt';
        addLibrarySubject(subj);
      }

      for (const doc of sessSnap.docs) {
        const r = doc.data() as Record<string, unknown>;
        const t = docTimeMs(r, 'createdAt');
        if (t == null || t < start.getTime() || t > end.getTime()) continue;
        chatSessionsInRange += 1;
      }
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
  let usageFailed = false;

  try {
    const usageBatches = await aggregateUsageByDays(db, usageDates, userIds);
    usageByDay = usageDates.map((date, i) => {
      const row = usageBatches[i]!;
      return { date, aiChats: row.aiChats, imageAnalyses: row.imageAnalyses };
    });
    for (const row of usageByDay) {
      usageSumAi += row.aiChats;
      usageSumImg += row.imageAnalyses;
    }
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
      byDay: usageByDay,
    },
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
