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
  Star,
  Trash2,
  Clock,
} from 'lucide-react';
import { auth, logout } from '../firebase';
import type { UserSubscription } from '../types';
import { hasPaidPlanAccess } from '../utils/subscriptionAccess';
import { apiUrl } from '../utils/apiBase';
import ConfirmDialog from './ui/ConfirmDialog';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const [deleteAccountError, setDeleteAccountError] = React.useState<string | null>(null);

  const paid = hasPaidPlanAccess(subscription);
  const periodLabel = formatPeriodEnd(subscription.currentPeriodEnd, i18n.language);
  const statusLine =
    subscription.status === 'trialing' ? t('subscription.statusTrialing') : t('subscription.statusActive');
  const memberHeadline = t('subscription.memberTitle');
  const memberSubtitle = t('subscription.memberSubtitle');

  const deleteAccount = React.useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const token = await u.getIdToken();
      const res = await fetch(apiUrl('/api/account/delete'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let message = t('subscription.deleteAccountError');
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          /* ignore */
        }
        setDeleteAccountError(message);
        setDeletingAccount(false);
        setShowDeleteConfirm(false);
        return;
      }
      await logout();
      window.location.href = '/';
    } catch {
      setDeleteAccountError(t('subscription.deleteAccountError'));
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
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
                <Star size={26} />
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

        {!paid && (
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
            <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50/80 dark:bg-slate-800/50 p-4 flex items-start gap-3">
              <Clock size={18} className="text-stone-400 mt-0.5 shrink-0" />
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{t('subscription.comingSoon')}</p>
            </div>
          </div>
        )}

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

        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-6">
          <h3 className="font-medium text-red-900 dark:text-red-300 mb-1">{t('subscription.dangerZoneTitle')}</h3>
          <p className="text-sm text-red-800/80 dark:text-red-300/70 mb-4">{t('subscription.dangerZoneBody')}</p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/60 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:focus-visible:ring-red-800"
          >
            <Trash2 size={16} />
            {t('subscription.deleteAccountButton')}
          </button>
          {deleteAccountError && (
            <p className="text-sm mt-2 text-red-700 dark:text-red-400">{deleteAccountError}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('subscription.deleteAccountButton')}
        message={t('subscription.deleteAccountConfirm')}
        confirmLabel={deletingAccount ? t('subscription.deleteAccountInProgress') : t('subscription.deleteAccountConfirmCta')}
        onConfirm={() => {
          if (deletingAccount) return;
          void deleteAccount();
        }}
        onCancel={() => {
          if (deletingAccount) return;
          setShowDeleteConfirm(false);
        }}
      />
    </div>
  );
}
