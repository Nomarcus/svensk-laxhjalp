import React, { useState } from 'react';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { supabase } from '../supabase';
import { cn } from '../utils/cn';
import type { SubscriptionTier } from '../types';

interface PricingCardProps {
  currentTier: SubscriptionTier;
  onUpgradeStart?: () => void;
  onUpgradeEnd?: () => void;
}

export default function PricingCard({ currentTier, onUpgradeStart, onUpgradeEnd }: PricingCardProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: 'plus' | 'pro') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(tier);
    onUpgradeStart?.();

    try {
      const token = session.access_token;
      const res = await fetch(`/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: `${tier}_${billing}`,
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
      setLoading(null);
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
        '3 AI-frågor per dag',
        '1 bildanalys per dag',
        '1 AI-illustration per dag',
        'Läxplanering & kalender',
        'Koppling till läroplanen',
      ],
    },
    {
      id: 'plus' as const,
      name: 'Plus',
      icon: <Star size={18} className="text-blue-500" />,
      priceMonthly: '29 kr',
      priceYearly: '249 kr',
      priceLabel: 'per månad',
      priceLabelYearly: 'per år (21 kr/mån)',
      borderColor: 'border-blue-400',
      activeBorder: 'border-blue-500',
      checkColor: 'text-blue-500',
      badge: 'Populär',
      badgeColor: 'bg-blue-500',
      features: [
        '15 AI-frågor per dag',
        '5 bildanalyser per dag',
        '2 AI-illustrationer per dag',
        'Resursbibliotek',
        'Facit-funktion',
        'Allt i Gratis',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      icon: <Crown size={18} className="text-amber-500" />,
      priceMonthly: '59 kr',
      priceYearly: '499 kr',
      priceLabel: 'per månad',
      priceLabelYearly: 'per år (42 kr/mån)',
      borderColor: 'border-amber-400',
      activeBorder: 'border-amber-500',
      checkColor: 'text-amber-500',
      badge: 'Familjepaket',
      badgeColor: 'bg-amber-500',
      features: [
        'Obegränsade AI-frågor',
        'Obegränsade bildanalyser',
        '5 AI-illustrationer per dag',
        'Dela kalender med föräldrar',
        'Prioriterad svarstid',
        'Allt i Plus',
      ],
    },
  ];

  const tierOrder = { free: 0, plus: 1, pro: 2 };

  return (
    <div>
      {/* Billing toggle */}
      {currentTier === 'free' && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setBilling('monthly')}
            className={cn(
              "text-sm px-4 py-2 rounded-full transition-all",
              billing === 'monthly'
                ? "bg-emerald-100 text-emerald-700 font-medium"
                : "text-stone-400 hover:bg-stone-100"
            )}
          >
            Månadsvis
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={cn(
              "text-sm px-4 py-2 rounded-full transition-all",
              billing === 'yearly'
                ? "bg-emerald-100 text-emerald-700 font-medium"
                : "text-stone-400 hover:bg-stone-100"
            )}
          >
            Årsvis
            <span className="ml-1 text-[10px] text-amber-600 font-bold">Spara 28%</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const canUpgrade = tierOrder[plan.id] > tierOrder[currentTier];

          return (
            <div
              key={plan.id}
              className={cn(
                "bg-white rounded-2xl p-5 border-2 transition-all relative overflow-hidden",
                isCurrent ? plan.activeBorder : plan.borderColor
              )}
            >
              {plan.badge && !isCurrent && (
                <div className={cn(
                  "absolute top-3 right-3 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                  plan.badgeColor
                )}>
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
                    <Check size={15} className={cn(plan.checkColor, "shrink-0 mt-0.5")} />
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
                  onClick={() => handleUpgrade(plan.id as 'plus' | 'pro')}
                  disabled={loading !== null}
                  className={cn(
                    "w-full py-2.5 text-white rounded-xl font-medium shadow-lg transition-all active:scale-[0.98] disabled:opacity-50",
                    plan.id === 'pro'
                      ? "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600"
                      : "bg-blue-500 shadow-blue-500/20 hover:bg-blue-600"
                  )}
                >
                  {loading === plan.id ? 'Vänta...' : `Uppgradera till ${plan.name}`}
                </button>
              ) : (
                <div className="py-2.5 text-center text-xs text-stone-400">
                  Ingår i din plan
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
