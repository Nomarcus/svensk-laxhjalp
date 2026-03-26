import React, { useState, useEffect } from 'react';
import { Crown, CreditCard, Clock, MessageCircle, Image, Palette } from 'lucide-react';
import { auth } from '../firebase';
import PricingCard from './PricingCard';
import type { UserSubscription } from '../types';

interface SubscriptionProps {
  subscription: UserSubscription;
}

interface UsageData {
  chatCount: number;
  imageCount: number;
  illustrationCount: number;
}

interface StatusData {
  usage: UsageData;
  hadTrial: boolean;
  trialEndsAt: any;
}

const DAILY_LIMITS: Record<string, { chat: number; image: number; illustration: number }> = {
  trial: { chat: 3, image: 1, illustration: 1 },
  plus:  { chat: 10, image: 3, illustration: 1 },
  pro:   { chat: 30, image: 10, illustration: 3 },
};

export default function Subscription({ subscription }: SubscriptionProps) {
  const [usage, setUsage] = useState<UsageData>({ chatCount: 0, imageCount: 0, illustrationCount: 0 });
  const [hadTrial, setHadTrial] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/billing/status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data: StatusData = await res.json();
      if (data.usage) setUsage(data.usage);
      if (data.hadTrial !== undefined) setHadTrial(data.hadTrial);
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  };

  const openPortal = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setPortalLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Kunde inte öppna abonnemangsportalen.');
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  const isPaid = subscription.tier === 'plus' || subscription.tier === 'pro';
  const isTrial = subscription.tier === 'trial';
  const hasActivePlan = isPaid || isTrial;

  const tierLabel =
    subscription.tier === 'pro' ? 'Pro' :
    subscription.tier === 'plus' ? 'Plus' :
    subscription.tier === 'trial' ? 'Testa Gratis' : 'Ingen plan';

  const tierColor =
    subscription.tier === 'pro' ? 'bg-amber-100 text-amber-600' :
    subscription.tier === 'plus' ? 'bg-blue-100 text-blue-600' :
    subscription.tier === 'trial' ? 'bg-emerald-100 text-emerald-600' :
    'bg-stone-100 text-stone-500';

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(typeof subscription.currentPeriodEnd === 'string'
        ? subscription.currentPeriodEnd
        : (subscription.currentPeriodEnd as any)?.toDate?.() || subscription.currentPeriodEnd
      )
    : null;

  const trialEnd = subscription.trialEndsAt
    ? new Date(typeof subscription.trialEndsAt === 'string'
        ? subscription.trialEndsAt
        : (subscription.trialEndsAt as any)?.toDate?.() || subscription.trialEndsAt
      )
    : null;

  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const limits = DAILY_LIMITS[subscription.tier] ?? null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0]">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h2 className="text-3xl font-serif italic mb-2">Abonnemang</h2>
          <p className="text-stone-500">Hantera ditt abonnemang och se din användning.</p>
        </header>

        {/* Current plan */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tierColor}`}>
                <Crown size={24} />
              </div>
              <div>
                <h3 className="font-medium text-lg">{tierLabel}</h3>
                <p className="text-sm text-stone-400">
                  {isPaid && !subscription.cancelAtPeriodEnd && 'Aktivt abonnemang'}
                  {isPaid && subscription.cancelAtPeriodEnd && 'Avslutas efter nuvarande period'}
                  {isTrial && trialDaysLeft > 0 && `Trial aktiv – ${trialDaysLeft} dag${trialDaysLeft !== 1 ? 'ar' : ''} kvar`}
                  {isTrial && trialDaysLeft === 0 && 'Trial avslutad'}
                  {!hasActivePlan && 'Ingen aktiv plan'}
                </p>
              </div>
            </div>
            {isPaid && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-all disabled:opacity-50"
              >
                <CreditCard size={16} />
                {portalLoading ? 'Öppnar...' : 'Hantera abonnemang'}
              </button>
            )}
          </div>

          {isPaid && periodEnd && (
            <div className="mt-4 pt-4 border-t border-black/5 flex items-center gap-2 text-sm text-stone-500">
              <Clock size={14} />
              {subscription.cancelAtPeriodEnd
                ? `Avslutas ${periodEnd.toLocaleDateString('sv-SE')}`
                : `Förnyas ${periodEnd.toLocaleDateString('sv-SE')}`
              }
            </div>
          )}
          {isTrial && trialEnd && (
            <div className="mt-4 pt-4 border-t border-black/5 flex items-center gap-2 text-sm text-stone-500">
              <Clock size={14} />
              Trial giltig till {trialEnd.toLocaleDateString('sv-SE')}
            </div>
          )}
        </div>

        {/* Daily usage (trial / paid) */}
        {hasActivePlan && limits && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Clock size={18} className="text-emerald-600" />
              Dagens användning
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle size={16} className="text-emerald-600" />
                  <span className="text-sm font-medium">AI-frågor</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.chatCount}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ {limits.chat}</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min((usage.chatCount / limits.chat) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image size={16} className="text-blue-600" />
                  <span className="text-sm font-medium">Bildanalyser</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.imageCount}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ {limits.image}</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min((usage.imageCount / limits.image) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={16} className="text-purple-600" />
                  <span className="text-sm font-medium">Illustrationer</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.illustrationCount}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ {limits.illustration}</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.min((usage.illustrationCount / limits.illustration) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing cards */}
        <div>
          <h3 className="font-medium text-lg mb-4 text-center">
            {isPaid ? 'Alla planer' : 'Välj en plan'}
          </h3>
          <PricingCard
            currentTier={subscription.tier}
            hadTrial={hadTrial || subscription.hadTrial}
            onTrialStarted={() => window.location.reload()}
          />
        </div>
      </div>
    </div>
  );
}
