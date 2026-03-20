import React, { useState } from 'react';
import { Check, Crown, Zap } from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../utils/cn';
import type { SubscriptionTier } from '../types';

interface PricingCardProps {
  currentTier: SubscriptionTier;
  onUpgradeStart?: () => void;
  onUpgradeEnd?: () => void;
}

export default function PricingCard({ currentTier, onUpgradeStart, onUpgradeEnd }: PricingCardProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    onUpgradeStart?.();

    try {
      const token = await user.getIdToken();
      const priceEnv = billing === 'monthly' ? 'monthly' : 'yearly';
      const res = await fetch(`/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: priceEnv, // Server will map to actual Stripe price ID
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

  const freeFeatures = [
    '3 AI-frågor per dag',
    '1 bildanalys per dag',
    'Läxplanering',
    'Resursbibliotek',
    'Koppling till läroplanen',
  ];

  const proFeatures = [
    'Obegränsade AI-frågor',
    'Obegränsad bildanalys',
    'AI-genererade illustrationer',
    'Prioriterad svarstid',
    'Allt i gratisplanen',
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      {/* Free */}
      <div className={cn(
        "bg-white rounded-2xl p-6 border-2 transition-all",
        currentTier === 'free' ? "border-emerald-500" : "border-black/5"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-stone-400" />
          <h3 className="font-medium text-lg">Gratis</h3>
        </div>
        <p className="text-3xl font-bold mb-1">0 kr</p>
        <p className="text-xs text-stone-400 mb-6">för alltid</p>

        <ul className="space-y-3 mb-6">
          {freeFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-stone-600">
              <Check size={16} className="text-emerald-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {currentTier === 'free' && (
          <div className="py-3 text-center text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl">
            Nuvarande plan
          </div>
        )}
      </div>

      {/* Pro */}
      <div className={cn(
        "bg-white rounded-2xl p-6 border-2 transition-all relative overflow-hidden",
        currentTier === 'pro' ? "border-emerald-500" : "border-amber-400"
      )}>
        {currentTier !== 'pro' && (
          <div className="absolute top-3 right-3 bg-amber-400 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
            Populär
          </div>
        )}

        <div className="flex items-center gap-2 mb-1">
          <Crown size={18} className="text-amber-500" />
          <h3 className="font-medium text-lg">Pro</h3>
        </div>

        {currentTier !== 'pro' && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                "text-xs px-3 py-1 rounded-full transition-all",
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
                "text-xs px-3 py-1 rounded-full transition-all",
                billing === 'yearly'
                  ? "bg-emerald-100 text-emerald-700 font-medium"
                  : "text-stone-400 hover:bg-stone-100"
              )}
            >
              Årsvis
              <span className="ml-1 text-[10px] text-amber-600 font-bold">-24%</span>
            </button>
          </div>
        )}

        <p className="text-3xl font-bold mb-1">
          {billing === 'monthly' ? '49 kr' : '449 kr'}
        </p>
        <p className="text-xs text-stone-400 mb-6">
          {billing === 'monthly' ? 'per månad' : 'per år (37 kr/mån)'}
        </p>

        <ul className="space-y-3 mb-6">
          {proFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-stone-600">
              <Check size={16} className="text-amber-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {currentTier === 'pro' ? (
          <div className="py-3 text-center text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl">
            Nuvarande plan
          </div>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Vänta...' : 'Uppgradera till Pro'}
          </button>
        )}
      </div>
    </div>
  );
}
