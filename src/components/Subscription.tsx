import React from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import {
  Heart,
  MessageCircle,
  Image,
  Palette,
  BookOpen,
  Sparkles,
  FileText,
  CreditCard,
  CheckCircle2,
  Crown,
  RefreshCw,
  Star,
} from 'lucide-react';
import { auth } from '../firebase';
import type { UserSubscription } from '../types';
import { hasPaidPlanAccess } from '../utils/subscriptionAccess';
import { apiUrl } from '../utils/apiBase';
import {
  STRIPE_BUY_BUTTON_ENABLED,
  STRIPE_PAYMENT_LINK_SUBSCRIBE,
  STRIPE_PAYMENT_LINKS_READY,
  buildStripePaymentLinkUrl,
} from '../utils/stripeBuyButton';

function formatPeriodEnd(value: unknown, locale: string): string | null {
  if (value == null) return null;
  try {
    let d: Date;
    if (value instanceof Timestamp) {
      d = value.toDate();
    } else if (typeof value === 'string') {
      d = new Date(value);
    } else {
      return null;
    }
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale, { dateStyle: 'long' });
  } catch {
    return null;
  }
}

interface SubscriptionProps {
  subscription: UserSubscription;
}

export default function Subscription({ subscription }: SubscriptionProps) {
  const { t, i18n } = useTranslation();
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [syncFeedback, setSyncFeedback] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const user = auth.currentUser;
  const isAnonymous = Boolean(user?.isAnonymous);
  const userUid = user?.uid || '';
  const userEmail = user?.email || '';

  const paid = hasPaidPlanAccess(subscription);
  const periodLabel = formatPeriodEnd(subscription.currentPeriodEnd, i18n.language);
  const statusLine =
    subscription.status === 'trialing' ? t('subscription.statusTrialing') : t('subscription.statusActive');
  const memberHeadline =
    subscription.tier === 'plus' ? t('subscription.plusMemberTitle') : t('subscription.premiumMemberTitle');
  const memberSubtitle =
    subscription.tier === 'plus' ? t('subscription.plusMemberSubtitle') : t('subscription.premiumMemberSubtitle');

  const subscribeUrl =
    userUid && userEmail && STRIPE_PAYMENT_LINK_SUBSCRIBE
      ? buildStripePaymentLinkUrl(STRIPE_PAYMENT_LINK_SUBSCRIBE, userUid, userEmail)
      : null;

  const syncFromStripe = React.useCallback(async () => {
    const u = auth.currentUser;
    if (!u || !u.email) return;
    setSyncLoading(true);
    setSyncFeedback(null);
    try {
      const token = await u.getIdToken();
      const res = await fetch(apiUrl('/api/billing/sync-stripe-subscription'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: {
        ok?: boolean;
        synced?: boolean;
        reason?: string;
        error?: string;
        detail?: string;
        duplicateActiveCount?: number;
      } = {};
      try {
        data = await res.json();
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        const parts = [(data as { error?: string }).error, (data as { detail?: string }).detail].filter(
          Boolean,
        ) as string[];
        setSyncFeedback({
          kind: 'err',
          text: parts.length > 0 ? parts.join(' — ') : t('subscription.syncServerError'),
        });
        return;
      }
      if (data.synced) {
        const dup = data.duplicateActiveCount || 0;
        setSyncFeedback({
          kind: 'ok',
          text: dup > 0 ? t('subscription.syncDuplicatesWarning', { count: dup }) : t('subscription.syncSuccess'),
        });
      } else if (data.reason === 'no_stripe_customer') {
        setSyncFeedback({ kind: 'err', text: t('subscription.syncNoCustomer') });
      } else if (data.reason === 'no_active_subscription') {
        setSyncFeedback({ kind: 'err', text: t('subscription.syncNoSubscription') });
      } else {
        setSyncFeedback({ kind: 'err', text: t('subscription.syncNoSubscription') });
      }
    } catch {
      setSyncFeedback({ kind: 'err', text: t('subscription.syncError') });
    } finally {
      setSyncLoading(false);
    }
  }, [t]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <h2 className="text-3xl font-serif italic mb-2 dark:text-stone-100">{t('subscription.title')}</h2>
          <p className="text-stone-500 dark:text-stone-400">{t('subscription.pageIntro')}</p>
        </header>

        {paid && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/80 dark:from-emerald-900/30 dark:to-emerald-900/15 rounded-2xl p-6 shadow-sm border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                {subscription.tier === 'plus' ? <Star size={26} /> : <Crown size={26} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg text-emerald-900 dark:text-emerald-200">{memberHeadline}</h3>
                <p className="text-sm text-emerald-800/85 dark:text-emerald-300/90 mt-1">{memberSubtitle}</p>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 mt-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  {statusLine}
                </p>
                {periodLabel && (
                  <p className="text-sm text-emerald-800/80 dark:text-emerald-400/85 mt-1">
                    {t('subscription.periodEnds', { date: periodLabel })}
                  </p>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-2 py-1.5">
                    {t('subscription.cancelAtPeriodEnd')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {subscription.status === 'past_due' && !paid && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/40 p-4 text-sm text-amber-950 dark:text-amber-200">
            <p className="font-medium">{t('subscription.pastDueTitle')}</p>
            <p className="mt-1 opacity-90">{t('subscription.pastDueBody')}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <h3 className="font-medium text-lg dark:text-stone-100 mb-3">{t('subscription.introTitle')}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-3">{t('subscription.introP1')}</p>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-3">{t('subscription.introP2')}</p>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
            {t('subscription.subscribeSupportBlurb')}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <h3 className="font-medium mb-4 flex items-center gap-2 dark:text-stone-100">
            <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
            {t('subscription.featuresTitle')}
          </h3>
          <div className="space-y-3">
            {[
              { icon: <MessageCircle size={14} />, text: t('subscription.featureAi'), sub: t('subscription.featureAiSub') },
              { icon: <Image size={14} />, text: t('subscription.featureImage'), sub: t('subscription.featureImageSub') },
              {
                icon: <Palette size={14} />,
                text: t('subscription.featureIllustration'),
                sub: t('subscription.featureIllustrationSub'),
              },
              { icon: <BookOpen size={14} />, text: t('subscription.featureLgr'), sub: t('subscription.featureLgrSub') },
              { icon: <FileText size={14} />, text: t('subscription.featurePlanner'), sub: t('subscription.featurePlannerSub') },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{item.text}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <CreditCard size={22} />
            </div>
            <div>
              <h3 className="font-medium text-lg dark:text-stone-100">{t('subscription.paymentTitle')}</h3>
              <p className="text-sm text-stone-400">{t('subscription.paymentSubtitle')}</p>
            </div>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 mb-4 leading-relaxed">{t('subscription.plansExplainer')}</p>

          {isAnonymous ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 p-3 text-sm text-rose-800 dark:text-rose-300">
              {t('subscription.stripeAnonymous')}
            </div>
          ) : !userUid || !userEmail ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 p-3 text-sm text-rose-800 dark:text-rose-300">
              {t('subscription.stripeEmailRequired')}
            </div>
          ) : paid ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800/30 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              {t('subscription.alreadySubscribed')}
            </div>
          ) : !STRIPE_BUY_BUTTON_ENABLED ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              {t('subscription.stripeDisabled')}
            </div>
          ) : !STRIPE_PAYMENT_LINKS_READY ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 p-3 text-sm text-rose-800 dark:text-rose-300">
              {t('subscription.stripeMissingConfig')}
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-50/80 dark:bg-slate-800/50 p-4 flex flex-col max-w-md mx-auto sm:mx-0">
              <div className="flex items-center gap-2 mb-2">
                <Star size={20} className="text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-stone-900 dark:text-stone-100">{t('subscription.planPlusName')}</h4>
              </div>
              <p className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">{t('subscription.planPlusPrice')}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 flex-1">{t('subscription.planPlusPerMonth')}</p>
              {subscribeUrl ? (
                <a
                  href={subscribeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {t('subscription.planCta')}
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-200 dark:bg-slate-700 text-stone-500 text-sm font-medium cursor-not-allowed"
                >
                  {t('subscription.planPlusSoon')}
                </button>
              )}
            </div>
          )}
          {!isAnonymous && userEmail ? (
            <div className="mt-5 pt-4 border-t border-stone-100 dark:border-white/10">
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">{t('subscription.syncStripeHint')}</p>
              <button
                type="button"
                onClick={syncFromStripe}
                disabled={syncLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-stone-100 dark:bg-slate-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors"
              >
                <RefreshCw size={16} className={syncLoading ? 'animate-spin' : ''} />
                {syncLoading ? t('subscription.syncStripeLoading') : t('subscription.syncStripeButton')}
              </button>
              {syncFeedback ? (
                <p
                  className={
                    syncFeedback.kind === 'ok'
                      ? 'text-sm mt-2 text-emerald-700 dark:text-emerald-400'
                      : 'text-sm mt-2 text-rose-700 dark:text-rose-400'
                  }
                >
                  {syncFeedback.text}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-2xl p-6 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Heart size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg text-emerald-900 dark:text-emerald-300">{t('subscription.supportTitle')}</h3>
              <p className="text-sm text-emerald-700/70 dark:text-emerald-400/70">{t('subscription.supportSubtitle')}</p>
            </div>
          </div>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed mb-4">
            {t('subscription.supportCompanyBody')}
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">{t('subscription.swishLabel')}</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">{t('subscription.swishComingSoon')}</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{t('subscription.swishNumberNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
