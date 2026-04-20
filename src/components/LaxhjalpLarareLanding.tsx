import React from 'react';
import { BookOpen, CheckCircle, GraduationCap, Moon, Sun } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface LaxhjalpLarareLandingProps {
  onGetStarted: () => void;
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
}

export default function LaxhjalpLarareLanding({
  onGetStarted,
  onShowPrivacy,
  onShowTerms,
  dark,
  onToggleDark,
}: LaxhjalpLarareLandingProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen app-soft-bg font-sans relative overflow-hidden text-stone-900 dark:text-stone-100">
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-blue-200/30 dark:bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-emerald-200/20 dark:bg-emerald-500/10 blur-3xl" />

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {onToggleDark && (
          <button
            type="button"
            onClick={onToggleDark}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-slate-800/90 border border-black/5 dark:border-white/10 text-stone-600 dark:text-stone-300 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-all"
            title={dark ? t('nav.lightMode') : t('nav.darkMode')}
            aria-label={dark ? t('nav.lightMode') : t('nav.darkMode')}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
        <LanguageSwitcher />
      </div>

      <article className="relative max-w-3xl mx-auto px-6 pt-24 pb-28 md:pt-28">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <GraduationCap size={22} />
            </div>
            <a
              href="/"
              className="text-lg font-serif italic text-stone-900 dark:text-stone-100 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
            >
              {t('app.fullName')}
            </a>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-stone-900 dark:text-stone-100 leading-tight mb-4">
            AI-stöd för lärare — rätta, planera och förklara snabbare
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            Föräldrahjälpen har ett inbyggt lärarläge som hjälper dig att snabbt rätta inlämningar, ge strukturerad återkoppling och koppla bedömning till{' '}
            <strong className="font-medium text-stone-800 dark:text-stone-200">Lgr22</strong>. Allt i ett enkelt flöde — utan att du behöver byta verktyg.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/85 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800/50">
            <CheckCircle size={14} /> Åk 1–9
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/85 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/50">
            <BookOpen size={14} /> Kopplat till Lgr22
          </span>
        </div>

        <div className="space-y-10 text-stone-700 dark:text-stone-300 leading-relaxed">
          <section aria-labelledby="sec-vad">
            <h2 id="sec-vad" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Vad kan du göra i lärarläget?
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-blue-600">
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Rätta inlämningar</strong> — klistra in eller fota elevtexten, välj kriterier och
                få ett förslag på återkoppling anpassad efter årskurs och kunskapskrav.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Skapa studieplaner</strong> — beskriv ett arbetsområde och få ett veckoschemat med
                rekommenderade aktiviteter och lämplig fördelning.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Förklara svåra begrepp</strong> — be AI formulera en förklaring på rätt nivå, som
                du kan använda direkt i undervisningen eller skicka hem till elever.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Fota uppgifter</strong> — ladda upp bilder av elevarbeten eller läromedel och få
                analys och kommentarer direkt.
              </li>
            </ul>
          </section>

          <section aria-labelledby="sec-lgr22">
            <h2 id="sec-lgr22" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Koppling till läroplanen
            </h2>
            <p className="mb-4">
              Återkoppling och förklaringar kan kopplas till kunskapskraven i{' '}
              <a
                href="https://www.skolverket.se/undervisning/grundskolan/laroplan-lgr-22-for-grundskolan-forskoleklassen-och-fritidshemmet"
                className="text-blue-700 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                Lgr22
              </a>
              . Det gör det enklare att formulera bedömningsgrunder som är transparenta och eleverna kan ta till sig — inte bara ett betyg utan ett tydligt nästa steg.
            </p>
          </section>

          <section aria-labelledby="sec-skillnad">
            <h2 id="sec-skillnad" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Skillnad mot generella AI-verktyg
            </h2>
            <p className="mb-4">
              Generella AI-chattar som ChatGPT kräver att du skriver långa promptar och känner till rätt instruktioner. Lärarläget i Föräldrahjälpen är förinställt
              för svensk grundskola: det känner till kunskapskraven, anpassar tonen efter elevens ålder och ger svar i ett format du kan använda direkt — utan att du
              behöver vara AI-expert.
            </p>
            <p>
              Verktyget är ett komplement, inte en ersättning för din professionella bedömning. Det är du som lärare som fattar det slutgiltiga beslutet — AI:n ger
              ett snabbt underlag att utgå ifrån.
            </p>
          </section>

          <section aria-labelledby="sec-faq">
            <h2 id="sec-faq" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Vanliga frågor
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="font-medium text-stone-900 dark:text-stone-100">Är det här ett officiellt skolverktyg?</dt>
                <dd className="mt-1">
                  Nej. Föräldrahjälpen är ett fristående verktyg byggt av en enskild utvecklare. Det är inte godkänt av Skolverket eller kommunen — du använder det
                  som ett personligt arbetshjälpmedel, precis som du kan använda Google Docs eller liknande.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900 dark:text-stone-100">Kan elevdata hanteras säkert?</dt>
                <dd className="mt-1">
                  Ange aldrig personuppgifter om elever i verktyget. Anonymisera alltid elevtexter innan du klistrar in dem — det är ditt ansvar som
                  personuppgiftsansvarig. Verktyget lagrar inte det du skriver i längre tid än nödvändigt för att generera svaret.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900 dark:text-stone-100">Kostar det något?</dt>
                <dd className="mt-1">
                  Du kan prova gratis. Är du nöjd och vill stödja vidare utveckling finns ett frivilligt abonnemang på 49 kr/mån — ingen bindningstid.
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-14 rounded-3xl border border-blue-200/80 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-950/35 p-8 text-center shadow-[0_18px_40px_-24px_rgba(37,99,235,0.35)]">
          <p className="text-stone-800 dark:text-stone-100 font-medium mb-4">Prova lärarläget — det tar en minut att komma igång</p>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center justify-center px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-medium shadow-[0_18px_40px_-24px_rgba(37,99,235,0.55)] hover:bg-blue-700 transition-all active:scale-[0.98]"
          >
            Kom igång gratis
          </button>
          <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
            Har du redan konto? Knappen tar dig till inloggning på{' '}
            <a href="/" className="text-blue-700 dark:text-blue-400 underline underline-offset-2">
              startsidan
            </a>
            .
          </p>
        </div>

        {(onShowPrivacy || onShowTerms) && (
          <p className="mt-10 text-center text-xs text-stone-400 dark:text-stone-500">
            {onShowTerms && (
              <button type="button" onClick={onShowTerms} className="underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                {t('auth.termsOfService')}
              </button>
            )}
            {onShowTerms && onShowPrivacy && ' · '}
            {onShowPrivacy && (
              <button type="button" onClick={onShowPrivacy} className="underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                {t('auth.privacyPolicy')}
              </button>
            )}
          </p>
        )}
      </article>
    </div>
  );
}
