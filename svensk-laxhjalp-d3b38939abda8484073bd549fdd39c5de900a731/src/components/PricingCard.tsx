import React, { useState } from 'react';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../utils/cn';
import type { SubscriptionTier } from '../types';

interface PricingCardProps {
  currentTier: SubscriptionTier;
  hadTrial?: boolean;
  onUpgradeStart?: () => void;
  onUpgradeEnd?: () => void;
  onTrialStarted?: () => void;
}

export default function PricingCard({ currentTier, hadTrial, onUpgradeStart, onUpgradeEnd, onTrialStarted }: PricingCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleStartTrial = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading('trial');
    onUpgradeStart?.();
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/billing/start-trial', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        onTrialStarted?.();
      } else {
        alert(data.error || 'Något gick fel.');
      }
    } catch {
      alert('Kunde inte starta trial. Försök igen.');
    } finally {
      setLoading(null);
      onUpgradeEnd?.();
    }
  };

  const handleUpgrade = async (tier: 'plus' | 'pro') => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(tier);
    onUpgradeStart?.();
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ priceId: `${tier}_monthly` }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Något gick fel.');
      }
    } catch {
      alert('Kunde inte starta betalningen. Försök igen.');
    } finally {
      setLoading(null);
      onUpgradeEnd?.();
    }
  };

  const tierOrder: Record<string, number> = { none: 0, trial: 1, plus: 2, pro: 3 };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">

      {/* Trial card */}
      <div className={cn(
        "bg-white rounded-2xl p-5 border-2 transition-all relative overflow-hidden",
        currentTier === 'trial' ? 'border-emerald-500' : 'border-black/5'
      )}>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-emerald-500" />
          <h3 className="font-medium text-lg">Testa Gratis</h3>
        </div>
        <p className="text-3xl font-bold mb-0.5">0 kr</p>
        <p className="text-xs text-stone-400 mb-5">7 dagar gratis</p>
        <ul className="space-y-2.5 mb-5">
          {[
            '3 AI-frågor per dag',
            '1 bildanalys per dag',
            '1 illustration per dag',
            'Läxplanering & kalender',
            'Koppling till läroplanen',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
              <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        {currentTier === 'trial' ? (
          <div className="py-2.5 text-center text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl">
            Trial aktiv
          </div>
        ) : hadTrial ? (
          <div className="py-2.5 text-center text-sm text-stone-400 bg-stone-50 rounded-xl">
            Trial redan använd
          </div>
        ) : (
          <button
            onClick={handleStartTrial}
            disabled={loading !== null}
            className="w-full py-2.5 text-white rounded-xl font-medium bg-emerald-500 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading === 'trial' ? 'Startar...' : 'Starta gratis trial'}
          </button>
        )}
      </div>

      {/* Plus card */}
      <div className={cn(
        "bg-white rounded-2xl p-5 border-2 transition-all relative overflow-hidden",
        currentTier === 'plus' ? 'border-blue-500' : 'border-blue-400'
      )}>
        <div className="absolute top-3 right-3 bg-blue-500 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
          Populär
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Star size={18} className="text-blue-500" />
          <h3 className="font-medium text-lg">Plus</h3>
        </div>
        <p className="text-3xl font-bold mb-0.5">49 kr</p>
        <p className="text-xs text-stone-400 mb-5">per månad</p>
        <ul className="space-y-2.5 mb-5">
          {[
            '10 AI-frågor per dag',
            '3 bildanalyser per dag',
            '1 illustration per dag',
            'Resursbibliotek',
            'Facit-funktion',
            'Allt i Testa Gratis',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
              <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        {currentTier === 'plus' ? (
          <div className="py-2.5 text-center text-sm font-medium text-blue-600 bg-blue-50 rounded-xl">
            Nuvarande plan
          </div>
        ) : tierOrder[currentTier] > tierOrder['plus'] ? (
          <div className="py-2.5 text-center text-xs text-stone-400">Ingår i din plan</div>
        ) : (
          <button
            onClick={() => handleUpgrade('plus')}
            disabled={loading !== null}
            className="w-full py-2.5 text-white rounded-xl font-medium bg-blue-500 shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading === 'plus' ? 'Vänta...' : 'Uppgradera till Plus'}
          </button>
        )}
      </div>

      {/* Pro card */}
      <div className={cn(
        "bg-white rounded-2xl p-5 border-2 transition-all relative overflow-hidden",
        currentTier === 'pro' ? 'border-amber-500' : 'border-amber-400'
      )}>
        <div className="absolute top-3 right-3 bg-amber-500 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
          Familjepaket
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Crown size={18} className="text-amber-500" />
          <h3 className="font-medium text-lg">Pro</h3>
        </div>
        <p className="text-3xl font-bold mb-0.5">79 kr</p>
        <p className="text-xs text-stone-400 mb-5">per månad</p>
        <ul className="space-y-2.5 mb-5">
          {[
            '30 AI-frågor per dag',
            '10 bildanalyser per dag',
            '3 illustrationer per dag',
            'Dela med annan förälder',
            'Prioriterad svarstid',
            'Allt i Plus',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
              <Check size={15} className="text-amber-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        {currentTier === 'pro' ? (
          <div className="py-2.5 text-center text-sm font-medium text-amber-600 bg-amber-50 rounded-xl">
            Nuvarande plan
          </div>
        ) : (
          <button
            onClick={() => handleUpgrade('pro')}
            disabled={loading !== null}
            className="w-full py-2.5 text-white rounded-xl font-medium bg-amber-500 shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading === 'pro' ? 'Vänta...' : 'Uppgradera till Pro'}
          </button>
        )}
      </div>

    </div>
  );
}
