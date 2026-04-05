import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { AlertCircle, BarChart3, BookOpen, Layers, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../utils/cn';

export type AnalyticsRange = 'day' | 'week' | 'month' | 'year' | 'all';

export type AnalyticsSubjectRow = {
  key: string;
  display: string;
  taskCount: number;
  libraryCount: number;
  totalMentions: number;
  tasksCompleted: number;
  tasksIncomplete: number;
  completionRate: number | null;
  avgProgress: number | null;
  withPhoto: number;
  withLinkedChat: number;
  withAiNotes: number;
  examTasks: number;
  withExamPrep: number;
};

export type AnalyticsPayload = {
  preset: AnalyticsRange;
  generatedAt: string;
  range: { startUtc: string; endUtc: string };
  sampledUsers: number;
  usersTotal: number;
  usageChartTruncated: boolean;
  usageFailed: boolean;
  totals: {
    tasksCreated: number;
    chatSessionsCreated: number;
    libraryItemsAdded: number;
    incompleteTasksOlderThanRange: number;
  };
  usage: { sumAiChats: number; sumImageAnalyses: number; byDay: { date: string; aiChats: number; imageAnalyses: number }[] };
  subjects: AnalyticsSubjectRow[];
  difficulty: {
    lowCompletionSubjects: AnalyticsSubjectRow[];
    lowAvgProgressSubjects: AnalyticsSubjectRow[];
  };
  features: {
    most: { id: string; count: number }[];
    least: { id: string; count: number }[];
  };
  notes: string[];
};

function fmtShort(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function featLabel(t: TFunction, id: string) {
  const k = `admin.analytics.feat.${id}`;
  const s = t(k);
  return s === k ? id : s;
}

type Props = {
  t: TFunction;
  range: AnalyticsRange;
  onRangeChange: (r: AnalyticsRange) => void;
  payload: AnalyticsPayload | null;
  loading: boolean;
  error: string | null;
};

const RANGES: AnalyticsRange[] = ['day', 'week', 'month', 'year', 'all'];

export default function AdminAnalyticsSection({ t, range, onRangeChange, payload, loading, error }: Props) {
  const chartMax = useMemo(() => {
    if (!payload?.usage.byDay.length) return 1;
    return Math.max(1, ...payload.usage.byDay.map((d) => d.aiChats + d.imageAnalyses));
  }, [payload]);

  return (
    <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1 flex items-center gap-2">
            <BarChart3 size={16} />
            {t('admin.analytics.title')}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-2xl">{t('admin.analytics.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                range === r
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-slate-700',
              )}
            >
              {t(`admin.analytics.range.${r}`)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !payload && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-stone-200/80 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {payload && (
        <>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {t('admin.analytics.period')}: {fmtShort(payload.range.startUtc)} — {fmtShort(payload.range.endUtc)} ·{' '}
            {t('admin.analytics.sampled', { n: payload.sampledUsers, total: payload.usersTotal })}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-stone-50 dark:bg-slate-800/50 p-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{t('admin.analytics.kpiTasks')}</p>
              <p className="text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums">{payload.totals.tasksCreated}</p>
            </div>
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-stone-50 dark:bg-slate-800/50 p-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{t('admin.analytics.kpiSessions')}</p>
              <p className="text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums">{payload.totals.chatSessionsCreated}</p>
            </div>
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-stone-50 dark:bg-slate-800/50 p-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{t('admin.analytics.kpiLibrary')}</p>
              <p className="text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums">{payload.totals.libraryItemsAdded}</p>
            </div>
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-stone-50 dark:bg-slate-800/50 p-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{t('admin.analytics.kpiStalled')}</p>
              <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                {payload.totals.incompleteTasksOlderThanRange}
              </p>
            </div>
          </div>

          <p className="text-sm text-stone-600 dark:text-stone-300">
            {t('admin.analytics.usageSum', { ai: payload.usage.sumAiChats, img: payload.usage.sumImageAnalyses })}
            {payload.usageChartTruncated && (
              <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">{t('admin.analytics.truncatedChart')}</span>
            )}
          </p>

          {!payload.usageFailed && payload.usage.byDay.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">{t('admin.analytics.chartTitle')}</h3>
              <div className="flex items-end gap-0.5 h-36 overflow-x-auto pb-1">
                {payload.usage.byDay.map((d) => {
                  const total = d.aiChats + d.imageAnalyses;
                  const barH = chartMax > 0 ? (total / chartMax) * 100 : 0;
                  const chatPct = total > 0 ? (d.aiChats / total) * 100 : 50;
                  const grad =
                    total === 0
                      ? 'rgb(214 211 209)'
                      : `linear-gradient(to top, rgb(5 150 105) 0%, rgb(5 150 105) ${chatPct}%, rgb(96 165 250) ${chatPct}%, rgb(96 165 250) 100%)`;
                  return (
                    <div key={d.date} className="flex-1 min-w-[5px] max-w-[14px] flex flex-col justify-end group relative h-full">
                      <div
                        className="mx-px rounded-t bg-stone-200 dark:bg-slate-700"
                        style={{
                          height: `${Math.max(barH, total === 0 ? 3 : 5)}%`,
                          background: total === 0 ? undefined : grad,
                        }}
                        title={`${d.date}: AI ${d.aiChats} · ${d.imageAnalyses}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-emerald-200/50 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp size={14} />
                {t('admin.analytics.featuresMost')}
              </h3>
              <ul className="space-y-2">
                {payload.features.most.map((f) => (
                  <li key={f.id} className="flex justify-between text-sm text-stone-700 dark:text-stone-200">
                    <span>{featLabel(t, f.id)}</span>
                    <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">{f.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/40 p-4">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingDown size={14} />
                {t('admin.analytics.featuresLeast')}
              </h3>
              <ul className="space-y-2">
                {payload.features.least.length === 0 ? (
                  <li className="text-sm text-stone-400">{t('admin.analytics.noLeast')}</li>
                ) : (
                  payload.features.least.map((f) => (
                    <li key={f.id} className="flex justify-between text-sm text-stone-700 dark:text-stone-200">
                      <span>{featLabel(t, f.id)}</span>
                      <span className="tabular-nums font-medium">{f.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <BookOpen size={14} />
              {t('admin.analytics.subjectsTitle')}
            </h3>
            <p className="text-xs text-stone-500 mb-3">{t('admin.analytics.subjectsHint')}</p>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-stone-400 border-b border-black/5 dark:border-white/10">
                    <th className="pb-2 pr-2 font-medium">{t('admin.analytics.colSubject')}</th>
                    <th className="pb-2 pr-2 font-medium tabular-nums">{t('admin.analytics.colTasksLib')}</th>
                    <th className="pb-2 pr-2 font-medium tabular-nums">{t('admin.analytics.colDone')}</th>
                    <th className="pb-2 pr-2 font-medium tabular-nums">{t('admin.analytics.colRate')}</th>
                    <th className="pb-2 font-medium tabular-nums">{t('admin.analytics.colProgress')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.subjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-stone-500 text-center">
                        {t('admin.analytics.noSubjects')}
                      </td>
                    </tr>
                  ) : (
                    payload.subjects.map((s) => (
                      <tr key={s.key} className="border-b border-black/5 dark:border-white/5 last:border-0">
                        <td className="py-2 pr-2 font-medium text-stone-800 dark:text-stone-200">{s.display}</td>
                        <td className="py-2 pr-2 tabular-nums text-stone-600 dark:text-stone-300">
                          {s.taskCount} / {s.libraryCount}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-stone-600 dark:text-stone-300">{s.tasksCompleted}</td>
                        <td className="py-2 pr-2 tabular-nums text-stone-600 dark:text-stone-300">
                          {s.completionRate != null ? `${Math.round(s.completionRate * 100)}%` : '—'}
                        </td>
                        <td className="py-2 tabular-nums text-stone-600 dark:text-stone-300">
                          {s.avgProgress != null ? `${s.avgProgress}%` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Layers size={14} />
                {t('admin.analytics.lowCompletion')}
              </h3>
              <p className="text-xs text-stone-500 mb-3">{t('admin.analytics.difficultyHint')}</p>
              <ul className="space-y-2 text-sm">
                {payload.difficulty.lowCompletionSubjects.length === 0 ? (
                  <li className="text-stone-500">{t('admin.analytics.noDifficulty')}</li>
                ) : (
                  payload.difficulty.lowCompletionSubjects.map((s) => (
                    <li key={s.key} className="flex justify-between gap-2 text-stone-700 dark:text-stone-200">
                      <span className="truncate">{s.display}</span>
                      <span className="tabular-nums shrink-0 text-amber-700 dark:text-amber-400">
                        {s.completionRate != null ? `${Math.round(s.completionRate * 100)}%` : '—'} · {s.taskCount}{' '}
                        {t('admin.analytics.tasksWord')}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-violet-200/60 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 p-4">
              <h3 className="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-widest mb-2">
                {t('admin.analytics.lowProgress')}
              </h3>
              <ul className="space-y-2 text-sm">
                {payload.difficulty.lowAvgProgressSubjects.length === 0 ? (
                  <li className="text-stone-500">{t('admin.analytics.noProgress')}</li>
                ) : (
                  payload.difficulty.lowAvgProgressSubjects.map((s) => (
                    <li key={s.key} className="flex justify-between gap-2 text-stone-700 dark:text-stone-200">
                      <span className="truncate">{s.display}</span>
                      <span className="tabular-nums shrink-0">
                        {s.avgProgress != null ? `${s.avgProgress}%` : '—'} · {s.taskCount} {t('admin.analytics.tasksWord')}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">{t('admin.analytics.notesTitle')}</h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-stone-500 dark:text-stone-400">
              {payload.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
