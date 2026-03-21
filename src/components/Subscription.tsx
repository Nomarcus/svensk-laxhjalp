import React, { useState, useEffect } from 'react';
import { Crown, CreditCard, Clock, MessageCircle, Image } from 'lucide-react';
import { auth } from '../firebase';
import PricingCard from './PricingCard';
import type { UserSubscription } from '../types';

interface SubscriptionProps {
  subscription: UserSubscription;
}

interface UsageData {
  chatCount: number;
  imageCount: number;
}

export default function Subscription({ subscription }: SubscriptionProps) {
  const [usage, setUsage] = useState<UsageData>({ chatCount: 0, imageCount: 0 });
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
      const data = await res.json();
      if (data.usage) {
        setUsage(data.usage);
      }
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

  const isPaid = subscription.tier === 'plus' || subscription.tier === 'pro';
  const tierLabel = subscription.tier === 'pro' ? 'Pro' : subscription.tier === 'plus' ? 'Plus' : 'Gratis';
  const tierColor = subscription.tier === 'pro' ? 'bg-amber-100 text-amber-600' : subscription.tier === 'plus' ? 'bg-blue-100 text-blue-600' : 'bg-stone-100 text-stone-500';
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(typeof subscription.currentPeriodEnd === 'string'
        ? subscription.currentPeriodEnd
        : subscription.currentPeriodEnd?.toDate?.() || subscription.currentPeriodEnd
      )
    : null;

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
                    : 'Grundplan med begränsningar'
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
        </div>

        {/* Usage (free tier) */}
        {!isPaid && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Clock size={18} className="text-emerald-600" />
              Dagens användning
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle size={16} className="text-emerald-600" />
                  <span className="text-sm font-medium">AI-frågor</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.chatCount}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ 5</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min((usage.chatCount / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image size={16} className="text-blue-600" />
                  <span className="text-sm font-medium">Bildanalyser</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-stone-800">{usage.imageCount}</span>
                  <span className="text-sm text-stone-400 mb-0.5">/ 2</span>
                </div>
                <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min((usage.imageCount / 2) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
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
