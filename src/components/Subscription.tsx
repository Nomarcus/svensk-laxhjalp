import React, { useState, useEffect } from 'react';
import { Crown, CreditCard, Clock, MessageCircle, Image, Palette } from 'lucide-react';
import { auth } from '../firebase';
import PricingCard from './PricingCard';
import type { UserSubscription } from '../types';

interface SubscriptionProps {
  subscription: UserSubscription;
}

interface UsageData {
  ai_questions_used: number;
  image_analyses_used: number;
  illustrations_used: number;
}

interface StatusData {
  plan_type: string;
  trial_ends_at: string | null;
  daily_limits: { ai_question: number; image_analysis: number; illustration: number };
  monthly_credits_total: number;
  monthly_credits_used: number;
  monthly_credits_remaining: number;
  usage: UsageData;
}

export default function Subscription({ subscription }: SubscriptionProps) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/billing/status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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

  const planType = status?.plan_type || subscription.plan_type || 'none';
  const isPaid = subscription.tier === 'plus' || subscription.tier === 'pro';
  const isTrial = planType === 'trial';
  const tierLabel = planType === 'pro' ? 'Pro' : planType === 'plus' ? 'Plus' : isTrial ? 'Testa gratis' : 'Ingen plan';
  const tierColor = planType === 'pro' ? 'bg-amber-100 text-amber-600' : planType === 'plus' ? 'bg-blue-100 text-blue-600' : isTrial ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-500';

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(typeof subscription.currentPeriodEnd === 'string'
        ? subscription.currentPeriodEnd
        : subscription.currentPeriodEnd?.toDate?.() || subscription.currentPeriodEnd
      )
    : null;

  const trialEndsAt = status?.trial_ends_at ? new Date(status.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const limits = status?.daily_limits || { ai_question: 0, image_analysis: 0, illustration: 0 };
  const usage = status?.usage || { ai_questions_used: 0, image_analyses_used: 0, illustrations_used: 0 };

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
                  {isPaid
                    ? subscription.cancelAtPeriodEnd
                      ? 'Avslutas efter nuvarande period'
                      : 'Aktivt abonnemang'
                    : isTrial
                      ? `${trialDaysLeft} dagar kvar av gratisperioden`
                      : 'Ingen aktiv plan'
                  }
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

          {isTrial && trialEndsAt && (
            <div className="mt-4 pt-4 border-t border-black/5 flex items-center gap-2 text-sm text-stone-500">
              <Clock size={14} />
              Gratisperioden slutar {trialEndsAt.toLocaleDateString('sv-SE')}
            </div>
          )}
        </div>

        {/* Usage */}
        {(isTrial || isPaid) && status && (
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
                  <span className="text-2xl font-bold text-stone-800">{usage.ai_questions_used}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ {limits.ai_question}</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${limits.ai_question > 0 ? Math.min((usage.ai_questions_used / limits.ai_question) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image size={16} className="text-blue-600" />
                  <span className="text-sm font-medium">Bildanalyser</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.image_analyses_used}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ {limits.image_analysis}</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${limits.image_analysis > 0 ? Math.min((usage.image_analyses_used / limits.image_analysis) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={16} className="text-purple-600" />
                  <span className="text-sm font-medium">Illustrationer</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.illustrations_used}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ {limits.illustration}</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${limits.illustration > 0 ? Math.min((usage.illustrations_used / limits.illustration) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Monthly credits */}
            {status.monthly_credits_total > 0 && (
              <div className="mt-4 pt-4 border-t border-black/5">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-stone-500">Månadskredit</span>
                  <span className="font-medium text-stone-700">
                    {status.monthly_credits_remaining} / {status.monthly_credits_total} kvar
                  </span>
                </div>
                <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${(status.monthly_credits_remaining / status.monthly_credits_total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pricing cards */}
        <div>
          <h3 className="font-medium text-lg mb-4 text-center">
            {isPaid ? 'Alla planer' : 'Uppgradera för mer användning'}
          </h3>
          <PricingCard currentTier={subscription.tier} />
        </div>
      </div>
    </div>
  );
}
