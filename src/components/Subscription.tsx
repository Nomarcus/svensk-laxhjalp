import React from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import { Heart, Construction, MessageCircle, Image, Palette, BookOpen, Sparkles, FileText, CreditCard, CheckCircle2, Crown } from 'lucide-react';
import { auth } from '../firebase';
import type { UserSubscription } from '../types';
import { hasPremiumAccess } from '../utils/subscriptionAccess';
import {
  STRIPE_BUY_BUTTON_ENABLED,
  STRIPE_BUY_BUTTON_ID,
  STRIPE_BUY_BUTTON_READY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_TRIAL_DAYS,
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
  const [stripeScriptReady, setStripeScriptReady] = React.useState(false);
  const user = auth.currentUser;
  const isAnonymous = Boolean(user?.isAnonymous);
  const userUid = user?.uid || '';
  const userEmail = user?.email || '';

  const premium = hasPremiumAccess(subscription);
  const periodLabel = formatPeriodEnd(subscription.currentPeriodEnd, i18n.language);
  const statusLine =
    subscription.status === 'trialing' ? t('subscription.statusTrialing') : t('subscription.statusActive');

  React.useEffect(() => {
    if (!STRIPE_BUY_BUTTON_ENABLED) return;
    const existing = document.querySelector<HTMLScriptElement>('script[data-stripe-buy-button="1"]');
    if (existing) {
      setStripeScriptReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/buy-button.js';
    script.async = true;
    script.dataset.stripeBuyButton = '1';
    script.onload = () => setStripeScriptReady(true);
    document.body.appendChild(script);
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <h2 className="text-3xl font-serif italic mb-2 dark:text-stone-100">Abonnemang</h2>
          <p className="text-stone-500 dark:text-stone-400">Tack för att du testar Föräldrahjälpen!</p>
        </header>

        {premium && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/80 dark:from-emerald-900/30 dark:to-emerald-900/15 rounded-2xl p-6 shadow-sm border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                <Crown size={26} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg text-emerald-900 dark:text-emerald-200">{t('subscription.premiumTitle')}</h3>
                <p className="text-sm text-emerald-800/85 dark:text-emerald-300/90 mt-1">{t('subscription.premiumSubtitle')}</p>
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

        {subscription.status === 'past_due' && !premium && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/40 p-4 text-sm text-amber-950 dark:text-amber-200">
            <p className="font-medium">{t('subscription.pastDueTitle')}</p>
            <p className="mt-1 opacity-90">{t('subscription.pastDueBody')}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Construction size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg dark:text-stone-100">Abonnemang under planering</h3>
              <p className="text-sm text-stone-400">Kommer snart!</p>
            </div>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Just nu är Föräldrahjälpen gratis att använda utan dagliga gränser. Vi jobbar på abonnemangsplaner
            som kan ge extra funktioner — de kommer snart!
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <h3 className="font-medium mb-4 flex items-center gap-2 dark:text-stone-100">
            <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
            Vad som ingår nu
          </h3>
          <div className="space-y-3">
            {[
              { icon: <MessageCircle size={14} />, text: 'AI-frågor och stöd', sub: 'Hjälp med läxor, förklaringar och tips' },
              { icon: <Image size={14} />, text: 'Bildanalys', sub: 'Fotografera läxan och få hjälp direkt' },
              { icon: <Palette size={14} />, text: 'AI-illustrationer', sub: 'Visuella förklaringar av svåra begrepp' },
              { icon: <BookOpen size={14} />, text: 'Koppling till läroplanen', sub: 'Se hur läxan kopplar till Lgr22' },
              { icon: <FileText size={14} />, text: 'Facit, studieplan & provförberedelse', sub: 'Planera och förbered inför prov' },
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <CreditCard size={22} />
            </div>
            <div>
              <h3 className="font-medium text-lg dark:text-stone-100">Stripe-betalning (UNDER TEST)</h3>
              <p className="text-sm text-stone-400">Testläge först, inte live för alla ännu</p>
            </div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/30 p-3 text-sm text-blue-800 dark:text-blue-300 mb-4 font-medium">
            TEST: Detta är en testsektion. Kontrollera flödet här innan aktivering för alla användare.
          </div>
          <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-300 mb-4">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              {`Gratisperiod: ${STRIPE_TRIAL_DAYS} dagar`}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Ett abonnemang (single plan) via Stripe Buy Button
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Endast inloggad användare (inte anonym)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Max ett abonnemang per konto (köpknappen döljs om du redan har Premium)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Stäng av med `VITE_ENABLE_STRIPE_BUY_BUTTON=false` om du vill dölja knappen helt
            </li>
          </ul>
          {isAnonymous ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 p-3 text-sm text-rose-800 dark:text-rose-300">
              Betaltest är blockerat för anonym användare. Logga in med e-postkonto för att testa betalning.
            </div>
          ) : !userUid || !userEmail ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 p-3 text-sm text-rose-800 dark:text-rose-300">
              Betaltest kräver inloggad användare med e-post så köpet kan kopplas till rätt konto.
            </div>
          ) : premium ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800/30 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              {t('subscription.alreadySubscribed')}
            </div>
          ) : !STRIPE_BUY_BUTTON_ENABLED ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              Stripe-knappen är avstängd. Ta bort `VITE_ENABLE_STRIPE_BUY_BUTTON=false` eller sätt variabeln
              till `true` om du vill visa den igen.
            </div>
          ) : !STRIPE_BUY_BUTTON_READY ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 p-3 text-sm text-rose-800 dark:text-rose-300">
              Stripe är påslaget men saknar konfiguration. Lägg till `VITE_STRIPE_BUY_BUTTON_ID` och `VITE_STRIPE_PUBLISHABLE_KEY`.
            </div>
          ) : !stripeScriptReady ? (
            <div className="text-sm text-stone-500">Laddar Stripe…</div>
          ) : (
            <div className="pt-1">
              <stripe-buy-button
                buy-button-id={STRIPE_BUY_BUTTON_ID}
                publishable-key={STRIPE_PUBLISHABLE_KEY}
                client-reference-id={userUid}
                customer-email={userEmail}
              />
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-2xl p-6 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Heart size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg text-emerald-900 dark:text-emerald-300">Stötta Föräldrahjälpen</h3>
              <p className="text-sm text-emerald-700/70 dark:text-emerald-400/70">Hjälp oss fortsätta utveckla appen</p>
            </div>
          </div>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed mb-4">
            Föräldrahjälpen är ett ideellt projekt som hjälper svenska föräldrar med barnens läxor.
            Om du gillar appen och vill att den ska fortsätta finnas — swisha gärna en valfri summa!
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">Swish</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Kommer snart</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Swish-nummer läggs till inom kort</p>
          </div>
        </div>
      </div>
    </div>
  );
}
