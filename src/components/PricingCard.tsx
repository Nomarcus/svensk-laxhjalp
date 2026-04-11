import React, { useState } from 'react';
import { Check, Star, Zap } from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../utils/cn';
import { apiUrl } from '../utils/apiBase';
import type { SubscriptionTier } from '../types';

interface PricingCardProps {
  currentTier: SubscriptionTier;
  onUpgradeStart?: () => void;
  onUpgradeEnd?: () => void;
}

function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'plus' || tier === 'pro';
}

export default function PricingCard({ currentTier, onUpgradeStart, onUpgradeEnd }: PricingCardProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const paid = isPaidTier(currentTier);

  const handleUpgrade = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    onUpgradeStart?.();

    try {
      const token = await user.getIdToken();
      const res = await fetch(apiUrl('/api/billing/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: billing === 'monthly' ? 'monthly' : 'yearly',
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Något gick fel.');
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      alert('Kunde inte starta betalningen. Försök igen.');
    } finally {
      setLoading(false);
      onUpgradeEnd?.();
    }
  };

  const plans = [
    {
      id: 'free' as const,
      name: 'Gratis',
      icon: <Zap size={18} className="text-stone-400" />,
      priceMonthly: '0 kr',
      priceYearly: '0 kr',
      priceLabel: 'för alltid',
      priceLabelYearly: 'för alltid',
      borderColor: 'border-black/5',
      activeBorder: 'border-emerald-500',
      checkColor: 'text-emerald-500',
      features: [
        '5 AI-svar i chatten per dag',
        '2 bildanalyser av läxfoton per dag',
        'Läxplanering, kalender och bibliotek',
        '1 premium uppläsning (TTS) per dag',
        'Koppling till Lgr22',
      ],
    },
    {
      id: 'paid' as const,
      name: 'Full version',
      icon: <Star size={18} className="text-blue-500" />,
      priceMonthly: '49 kr',
      priceYearly: 'Se årspris i kassan',
      priceLabel: 'per månad',
      priceLabelYearly: 'per år',
      borderColor: 'border-blue-400',
      activeBorder: 'border-blue-500',
      checkColor: 'text-blue-500',
      badge: 'Allt ingår',
      badgeColor: 'bg-blue-500',
      features: [
        'Obegränsade AI-svar och bildanalyser',
        'AI-illustrationer till uppgifter',
        'Obegränsad premium uppläsning',
        'Allt i gratisnivån',
      ],
    },
  ];

  return (
    <div>
      {!paid && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={cn(
              'text-sm px-4 py-2 rounded-full transition-all',
              billing === 'monthly'
                ? 'bg-emerald-100 text-emerald-700 font-medium'
                : 'text-stone-400 hover:bg-stone-100',
            )}
          >
            Månadsvis
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={cn(
              'text-sm px-4 py-2 rounded-full transition-all',
              billing === 'yearly'
                ? 'bg-emerald-100 text-emerald-700 font-medium'
                : 'text-stone-400 hover:bg-stone-100',
            )}
          >
            Årsvis
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = plan.id === 'free' ? currentTier === 'free' : paid;
          const canUpgrade = plan.id === 'paid' && currentTier === 'free';

          return (
            <div
              key={plan.id}
              className={cn(
                'bg-white rounded-2xl p-5 border-2 transition-all relative overflow-hidden',
                isCurrent ? plan.activeBorder : plan.borderColor,
              )}
            >
              {plan.badge && !isCurrent && (
                <div
                  className={cn(
                    'absolute top-3 right-3 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider',
                    plan.badgeColor,
                  )}
                >
                  {plan.badge}
                </div>
              )}

              <div className="flex items-center gap-2 mb-1">
                {plan.icon}
                <h3 className="font-medium text-lg">{plan.name}</h3>
              </div>

              <p className="text-3xl font-bold mb-0.5">
                {billing === 'monthly' ? plan.priceMonthly : plan.priceYearly}
              </p>
              <p className="text-xs text-stone-400 mb-5">
                {billing === 'monthly' ? plan.priceLabel : plan.priceLabelYearly}
              </p>

              <ul className="space-y-2.5 mb-5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                    <Check size={15} className={cn(plan.checkColor, 'shrink-0 mt-0.5')} />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="py-2.5 text-center text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl">
                  Nuvarande plan
                </div>
              ) : canUpgrade ? (
                <button
                  type="button"
                  onClick={() => void handleUpgrade()}
                  disabled={loading}
                  className="w-full py-2.5 text-white rounded-xl font-medium shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 bg-blue-500 shadow-blue-500/20 hover:bg-blue-600"
                >
                  {loading ? 'Vänta…' : 'Fortsätt till betalning'}
                </button>
              ) : (
                <div className="py-2.5 text-center text-xs text-stone-400">Ingår i din plan</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
