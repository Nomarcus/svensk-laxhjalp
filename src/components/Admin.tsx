import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Eye,
  EyeOff,
  ImageIcon,
  MessageSquare,
  RefreshCw,
  Users,
  Layers,
  Lightbulb,
} from 'lucide-react';
import { auth, onAuthStateChanged, signInWithEmail, type User } from '../firebase';
import { cn } from '../utils/cn';
import { apiUrl } from '../utils/apiBase';
import { OPERATOR_ADMIN_EMAIL } from '../utils/adminClient';
import AdminAnalyticsSection, { type AnalyticsPayload, type AnalyticsRange } from './AdminAnalyticsSection';

type OverviewPayload = {
  generatedAt: string;
  config: {
    soleAdminConfigured: boolean;
    usersSampled: number;
    usersTotal: number;
    cappedSample: boolean;
  };
  totals: {
    users: number;
    children: number;
    chatSessions: number;
    tasks: number;
    libraryItems: number;
  };
  engagement: { withEmail: number; guests: number; activeLast7DaysInSample: number };
  subscription: { byTier: Record<string, number>; byStatus: Record<string, number> };
  usage: {
    todayUtc: string;
    today: { aiChats: number; imageAnalyses: number; activeUsers: number };
    last14Days: { date: string; aiChats: number; imageAnalyses: number; activeUsers: number }[];
  };
  recentUsers: {
    uid: string;
    email: string | null;
    displayName: string | null;
    tier: string;
    subscriptionStatus: string;
    lastLogin: string | null;
  }[];
  topUsersToday: { uid: string; email: string | null; aiChats: number; imageAnalyses: number }[];
  insights: string[];
};

function Kpi({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

type AdminProps = { standalone?: boolean };

export default function Admin({ standalone }: AdminProps) {
  const { t } = useTranslation();
  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loginEmail, setLoginEmail] = useState(OPERATOR_ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('month');
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsErr, setAnalyticsErr] = useState<string | null>(null);
  /** Ladda analys efter översikt så vi inte slår API med två tunga anrop samtidigt (Cloud Run-timeout). */
  const [overviewReady, setOverviewReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setAuthUser);
    return unsub;
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch(apiUrl('/api/admin/overview'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setErr(t('admin.loadError'));
        setLoading(false);
        return;
      }
      const json = (await res.json()) as OverviewPayload;
      setData(json);
    } catch {
      setErr(t('admin.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsErr(null);
    setAnalyticsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setAnalyticsLoading(false);
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch(apiUrl(`/api/admin/analytics?range=${analyticsRange}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setForbidden(true);
        setAnalytics(null);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = t('admin.analytics.loadError');
        try {
          const j = JSON.parse(text) as { detail?: string };
          if (typeof j.detail === 'string' && j.detail.trim()) {
            msg = `${msg} (${j.detail.trim()})`;
          }
        } catch {
          /* ignore */
        }
        setAnalyticsErr(msg);
        setAnalytics(null);
        return;
      }
      setAnalytics((await res.json()) as AnalyticsPayload);
    } catch {
      setAnalyticsErr(t('admin.analytics.loadError'));
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsRange, t]);

  useEffect(() => {
    if (!authUser) {
      setData(null);
      setLoading(false);
      setErr(null);
      setForbidden(false);
      setAnalytics(null);
      setOverviewReady(false);
      return;
    }
    setOverviewReady(false);
    void load().finally(() => setOverviewReady(true));
  }, [authUser, load]);

  useEffect(() => {
    if (!authUser || !overviewReady) return;
    void loadAnalytics();
  }, [authUser, overviewReady, analyticsRange, loadAnalytics]);

  const mapLoginError = useCallback(
    (code: string) => {
      const map: Record<string, string> = {
        'auth/invalid-email': t('authErrors.invalidEmail'),
        'auth/user-not-found': t('authErrors.userNotFound'),
        'auth/wrong-password': t('authErrors.wrongPassword'),
        'auth/invalid-credential': t('authErrors.invalidCredential'),
        'auth/too-many-requests': t('authErrors.tooManyRequests'),
        'auth/operation-not-allowed': t('authErrors.providerNotEnabled'),
      };
      return map[code] || t('admin.loginErrorGeneric');
    },
    [t],
  );

  const handleOperatorLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoginBusy(true);
    try {
      await signInWithEmail(loginEmail.trim(), loginPassword);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      setLoginErr(mapLoginError(code));
    } finally {
      setLoginBusy(false);
    }
  };

  const leaveStandalone = () => {
    window.location.replace(window.location.pathname || '/');
  };

  const chartMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      ...data.usage.last14Days.map((d) => d.aiChats + d.imageAnalyses),
    );
  }, [data]);

  const tierEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.subscription.byTier).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (!authUser) {
    const shell = standalone ? 'min-h-screen' : 'flex-1';
    return (
      <div className={`${shell} overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950 flex flex-col`}>
        <div className="max-w-md w-full mx-auto my-auto">
          {standalone && (
            <button
              type="button"
              onClick={leaveStandalone}
              className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 mb-6"
            >
              <ArrowLeft size={16} />
              {t('admin.leaveOperatorGate')}
            </button>
          )}
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-8 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">
              {t('admin.badge')}
            </p>
            <h1 className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-1">{t('admin.loginTitle')}</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">{t('admin.loginSubtitle')}</p>
            {loginErr && (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                {loginErr}
              </div>
            )}
            <form onSubmit={(e) => void handleOperatorLogin(e)} className="space-y-4">
              <input
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-stone-800 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900/50"
                placeholder={t('admin.loginEmail')}
              />
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-stone-800 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900/50"
                  placeholder={t('admin.loginPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1"
                  aria-label={showPw ? 'Hide' : 'Show'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={loginBusy}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loginBusy ? t('auth.waiting') : t('admin.loginSubmit')}
              </button>
            </form>
            <p className="mt-6 text-xs text-stone-400 dark:text-stone-500 leading-relaxed">{t('admin.loginHint')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
        <div className="max-w-lg mx-auto rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-4" />
          <h1 className="text-xl font-serif italic text-stone-900 dark:text-stone-100 mb-2">{t('admin.forbiddenTitle')}</h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{t('admin.forbiddenBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">
              {t('admin.badge')}
            </p>
            <h1 className="text-3xl font-serif italic text-stone-900 dark:text-stone-100">{t('admin.title')}</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-xl">{t('admin.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void load();
              void loadAnalytics();
            }}
            disabled={loading || analyticsLoading}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-medium text-sm transition-all',
              'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20',
              'disabled:opacity-60 disabled:pointer-events-none',
            )}
          >
            <RefreshCw className={cn('w-4 h-4', (loading || analyticsLoading) && 'animate-spin')} />
            {t('admin.refresh')}
          </button>
        </header>

        <AdminAnalyticsSection
          t={t}
          range={analyticsRange}
          onRangeChange={setAnalyticsRange}
          payload={analytics}
          loading={analyticsLoading}
          error={analyticsErr}
        />

        {err && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {err}
          </div>
        )}

        {loading && !data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-stone-200/80 dark:bg-slate-800" />
            ))}
          </div>
        )}

        {data && (
          <>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {t('admin.updated')}: {fmtDate(data.generatedAt)}
              {data.config.cappedSample && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  · {t('admin.partialSample', { n: data.config.usersSampled, total: data.config.usersTotal })}
                </span>
              )}
            </p>

            <section>
              <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3">
                {t('admin.sectionOverview')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <Kpi label={t('admin.kpiUsers')} value={data.totals.users} icon={<Users size={20} />} />
                <Kpi
                  label={t('admin.kpiChildren')}
                  value={data.totals.children}
                  sub={t('admin.kpiChildrenHint')}
                  icon={<Users size={20} />}
                />
                <Kpi
                  label={t('admin.kpiSessions')}
                  value={data.totals.chatSessions}
                  sub={t('admin.kpiSessionsHint')}
                  icon={<MessageSquare size={20} />}
                />
                <Kpi
                  label={t('admin.kpiTasks')}
                  value={data.totals.tasks}
                  sub={t('admin.kpiTasksHint')}
                  icon={<Calendar size={20} />}
                />
                <Kpi
                  label={t('admin.kpiLibrary')}
                  value={data.totals.libraryItems}
                  sub={t('admin.kpiLibraryHint')}
                  icon={<BookOpen size={20} />}
                />
                <Kpi
                  label={t('admin.kpiTodayAi')}
                  value={data.usage.today.aiChats}
                  sub={t('admin.kpiTodayAiSub', { images: data.usage.today.imageAnalyses, day: data.usage.todayUtc })}
                  icon={<Activity size={20} />}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Layers size={16} />
                  {t('admin.sectionSubscriptions')}
                </h2>
                <div className="space-y-3">
                  {tierEntries.length === 0 && (
                    <p className="text-sm text-stone-500">{t('admin.noTierData')}</p>
                  )}
                  {tierEntries.map(([tier, count]) => {
                    const pct = data.config.usersSampled > 0 ? Math.round((count / data.config.usersSampled) * 100) : 0;
                    return (
                      <div key={tier}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-stone-700 dark:text-stone-200 capitalize">{tier}</span>
                          <span className="text-stone-500 tabular-nums">
                            {count} <span className="text-stone-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 dark:bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/10 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {data.engagement.activeLast7DaysInSample}
                    </p>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wide">{t('admin.active7d')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {data.engagement.withEmail}
                    </p>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wide">{t('admin.withEmail')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {data.engagement.guests}
                    </p>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wide">{t('admin.guests')}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4">
                  {t('admin.sectionUsage')}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">{t('admin.usageCaption')}</p>
                <div className="flex items-end gap-1 h-40">
                  {data.usage.last14Days.map((d) => {
                    const total = d.aiChats + d.imageAnalyses;
                    const barH = chartMax > 0 ? (total / chartMax) * 100 : 0;
                    const chatPct = total > 0 ? (d.aiChats / total) * 100 : 50;
                    const grad =
                      total === 0
                        ? 'linear-gradient(to top, rgb(214 211 209), rgb(214 211 209))'
                        : `linear-gradient(to top, rgb(5 150 105) 0%, rgb(5 150 105) ${chatPct}%, rgb(96 165 250) ${chatPct}%, rgb(96 165 250) 100%)`;
                    return (
                      <div key={d.date} className="flex-1 min-w-0 flex flex-col justify-end group relative">
                        <div
                          className="mx-0.5 rounded-t-md bg-stone-200 dark:bg-slate-700 overflow-hidden"
                          style={{
                            height: `${Math.max(barH, total === 0 ? 4 : 6)}%`,
                            background: total === 0 ? undefined : grad,
                          }}
                          title={`${d.date}: ${d.aiChats} + ${d.imageAnalyses}`}
                        />
                        <p className="text-[9px] text-center text-stone-400 truncate mt-1">
                          {d.date.slice(5)}
                        </p>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 px-2 py-1 rounded-lg bg-stone-900 text-white text-[10px] whitespace-nowrap shadow-lg">
                          {d.date}: AI {d.aiChats} · {t('admin.img')} {d.imageAnalyses} · {t('admin.activeUsers')}{' '}
                          {d.activeUsers}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500" /> {t('admin.legendChats')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-400" /> {t('admin.legendImages')}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Lightbulb size={16} />
                {t('admin.insights')}
              </h2>
              <ul className="space-y-2">
                {data.insights.length === 0 ? (
                  <li className="text-sm text-stone-500">{t('admin.noInsights')}</li>
                ) : (
                  data.insights.map((line) => (
                    <li key={line} className="text-sm text-stone-700 dark:text-stone-200 flex gap-2">
                      <span className="text-emerald-500 shrink-0">●</span>
                      {line}
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm overflow-hidden">
                <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4">
                  {t('admin.topToday')}
                </h2>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="text-left text-stone-400 border-b border-black/5 dark:border-white/10">
                        <th className="pb-2 pr-2 font-medium">{t('admin.colUser')}</th>
                        <th className="pb-2 pr-2 font-medium tabular-nums">
                          <MessageSquare className="inline w-3 h-3 mr-1" />
                          AI
                        </th>
                        <th className="pb-2 font-medium tabular-nums">
                          <ImageIcon className="inline w-3 h-3 mr-1" />
                          {t('admin.img')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topUsersToday.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-stone-500 text-center">
                            {t('admin.noUsageToday')}
                          </td>
                        </tr>
                      ) : (
                        data.topUsersToday.map((u) => (
                          <tr key={u.uid} className="border-b border-black/5 dark:border-white/5 last:border-0">
                            <td className="py-2 pr-2">
                              <p className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                                {u.email || u.uid.slice(0, 8)}
                              </p>
                            </td>
                            <td className="py-2 pr-2 tabular-nums text-stone-600 dark:text-stone-300">{u.aiChats}</td>
                            <td className="py-2 tabular-nums text-stone-600 dark:text-stone-300">{u.imageAnalyses}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm overflow-hidden">
                <h2 className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4">
                  {t('admin.recentUsers')}
                </h2>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-left text-stone-400 border-b border-black/5 dark:border-white/10">
                        <th className="pb-2 pr-2 font-medium">{t('admin.colUser')}</th>
                        <th className="pb-2 pr-2 font-medium">{t('admin.colTier')}</th>
                        <th className="pb-2 font-medium">{t('admin.colLastLogin')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentUsers.map((u) => (
                        <tr key={u.uid} className="border-b border-black/5 dark:border-white/5 last:border-0">
                          <td className="py-2 pr-2">
                            <p className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[180px]">
                              {u.displayName || u.email || u.uid.slice(0, 8)}
                            </p>
                            {u.email && (
                              <p className="text-[11px] text-stone-400 truncate max-w-[200px]">{u.email}</p>
                            )}
                          </td>
                          <td className="py-2 pr-2 capitalize text-stone-600 dark:text-stone-300">
                            {u.tier}
                            <span className="text-stone-400 text-[10px] block">{u.subscriptionStatus}</span>
                          </td>
                          <td className="py-2 text-stone-600 dark:text-stone-300 whitespace-nowrap text-xs">
                            {fmtDate(u.lastLogin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
