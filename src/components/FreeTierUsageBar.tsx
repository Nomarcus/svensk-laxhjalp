import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
import { fetchBillingStatus, type BillingStatusResponse } from '../utils/billingUsage';
import { subscribeUsageRefresh } from '../utils/usageRefresh';
import { cn } from '../utils/cn';

type Props = {
  className?: string;
};

export default function FreeTierUsageBar({ className }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth.currentUser) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchBillingStatus();
      setData(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeUsageRefresh(() => void load()), [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  if (!auth.currentUser || loading || !data?.metered || !data.limits || !data.remaining) {
    return null;
  }

  const { limits, remaining } = data;
  const items = [
    {
      key: 'chat',
      label: t('chat.freeQuotaChat', { remaining: remaining.chat, total: limits.chatDaily }),
      warn: remaining.chat <= 0,
    },
    {
      key: 'img',
      label: t('chat.freeQuotaImage', { remaining: remaining.imageInChat, total: limits.imageInChatDaily }),
      warn: remaining.imageInChat <= 0,
    },
    {
      key: 'tts',
      label: t('chat.freeQuotaTts', { remaining: remaining.aiTts, total: limits.aiTtsDaily }),
      warn: remaining.aiTts <= 0,
    },
  ];

  return (
    <div
      className={cn(
        'text-[11px] sm:text-xs leading-snug text-stone-600 dark:text-stone-400 bg-stone-50/90 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/10 rounded-xl px-3 py-2',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium text-stone-700 dark:text-stone-300">{t('chat.freeQuotaTitle')}</span>
      <span className="mx-1.5 text-stone-300 dark:text-stone-600">·</span>
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i > 0 && <span className="mx-1.5 text-stone-300 dark:text-stone-600">·</span>}
          <span className={item.warn ? 'text-amber-700 dark:text-amber-400 font-medium' : undefined}>{item.label}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
