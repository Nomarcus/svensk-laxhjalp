import React from 'react';
import { BookOpen, CheckCircle, GraduationCap, Moon, Sun } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface LaxhjalpForaldrarLandingProps {
  onGetStarted: () => void;
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
}

export default function LaxhjalpForaldrarLanding({
  onGetStarted,
  onShowPrivacy,
  onShowTerms,
  dark,
  onToggleDark,
}: LaxhjalpForaldrarLandingProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen app-soft-bg font-sans relative overflow-hidden text-stone-900 dark:text-stone-100">
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-emerald-200/30 dark:bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-blue-200/20 dark:bg-blue-500/10 blur-3xl" />

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

      {i18n.language === 'ar' && (
        <div className="absolute top-16 left-4 right-4 z-10 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
          <span>⚠️</span>
          {t('language.betaNotice')}
        </div>
      )}

      <article className="relative max-w-3xl mx-auto px-6 pt-24 pb-28 md:pt-28">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <BookOpen size={22} />
            </div>
            <a
              href="/"
              className="text-lg font-serif italic text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              {t('app.fullName')}
            </a>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-stone-900 dark:text-stone-100 leading-tight mb-4">
            Läxhjälp för föräldrar — när du behöver förstå och strukturera, inte bara färdiga svar
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            Många som söker ordet <strong className="font-medium text-stone-800 dark:text-stone-200">läxhjälp</strong> hittar annonser riktade till elever:
            privatlärare, coacher eller läxhjälp på plats. Det är en viktig del av marknaden — men inte alltid det du som{' '}
            <strong className="font-medium text-stone-800 dark:text-stone-200">förälder</strong> behöver. Här beskriver vi läxhjälp ur föräldraperspektiv:
            hur du snabbt förstår uppgiften, kan vägleda ditt barn och håller koll på veckan utan att bli &quot;resurs&quot; på barnets bekostnad.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/85 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/50">
            <CheckCircle size={14} /> För åk 1–9
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/85 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800/50">
            <GraduationCap size={14} /> Kopplat till Lgr22
          </span>
        </div>

        <div className="space-y-10 text-stone-700 dark:text-stone-300 leading-relaxed">
          <section aria-labelledby="sec-varfor">
            <h2 id="sec-varfor" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Varför söker föräldrar efter läxhjälp?
            </h2>
            <p>
              Läxor hamnar ofta på kvällen, när tiden är kort och energin är låg. Samtidigt har skolan förändrats: nya begrepp, andra metoder än när du
              själv gick i skolan, och ibland språkbarriärer i familjen. Då är det naturligt att googla <em>läxhjälp</em> — men det du egentligen vill ha kan vara
              kortfattat stöd till dig: &quot;Vad betyder uppgiften?&quot;, &quot;Hur kan jag förklara utan att ta över?&quot; och &quot;När ska det vara klart?&quot;
            </p>
          </section>

          <section aria-labelledby="sec-skillnad">
            <h2 id="sec-skillnad" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Skillnad mellan läxhjälp till eleven och stöd till dig som förälder
            </h2>
            <p className="mb-4">
              Traditionell läxhjälp riktar sig ofta direkt mot eleven: repetition, träning inför prov, eller genomgång av ett dokumenterat läx-schema. Det kan vara
              rätt val när barnet behöver kontinuerlig handledning. Föräldrahjälpen är byggt för ett annat behov: att{' '}
              <strong className="font-medium text-stone-800 dark:text-stone-200">du</strong> ska kunna ge meningsfull hjälp hemma — med förklaringar du själv
              förstår, anpassade efter barnets årskurs, och en kalender som gör att hela familjen ser samma bild av veckan.
            </p>
            <p>
              I praktiken handlar det om pedagogisk läxhjälp där <em>föräldern</em> är primär användare: du ställer frågor, fotar uppgifter och planerar — och
              använder svaren för att möta ditt barn på ett sätt som stärker förståelse snarare än korta fasitsvar i elevens namn.
            </p>
          </section>

          <section aria-labelledby="sec-hur">
            <h2 id="sec-hur" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Så kan Föräldrahjälpen fungera i er vardag
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-emerald-600">
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Chat med AI</strong> för att få steg-för-steg-förklaringar när något känns
                otydligt i läxboken eller på lärarens material.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Fota läxan</strong> så att du slipper skriva av långa uppgifter — bilder och text
                kan analyseras i samma flöde som frågor.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Veckoplanering</strong> med tydliga arbetsdagar och inlämning — särskilt värdefullt
                om två hushåll ska hänga med i samma schema.
              </li>
            </ul>
          </section>

          <section aria-labelledby="sec-lgr22">
            <h2 id="sec-lgr22" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Svensk grundskola och Lgr22
            </h2>
            <p className="mb-4">
              Förklaringar kan kopplas till den nuvarande läroplanen för grundskolan (Lgr 22), så du ser vilken typ av kunskap skolan siktar mot — inte bara ett
              enstaka rätt svar. Officiell information om Lgr 22 finns hos{' '}
              <a
                href="https://www.skolverket.se/undervisning/grundskolan/laroplan-lgr-22-for-grundskolan-forskoleklassen-och-fritidshemmet"
                className="text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-800 dark:hover:text-emerald-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                Skolverket
              </a>
              .
            </p>
            <p>
              Om du letar efter bred <a href="/" className="text-emerald-700 dark:text-emerald-400 underline underline-offset-2">AI-läxhjälp</a> med samma verktyg
              men mer översiktlig presentation finns startsidan; den här sidan fokuserar på sökintentionen <em>läxhjälp för föräldrar</em>.
            </p>
          </section>

          <section aria-labelledby="sec-faq">
            <h2 id="sec-faq" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Kort svar på vanliga frågor
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="font-medium text-stone-900 dark:text-stone-100">Är det här en läxhjälp-tjänst som skriver åt barnet?</dt>
                <dd className="mt-1">
                  Nej. Syftet är att du som vuxen ska förstå och kunna vägleda. Det är en annan roll än att leverera färdiga elev-svar — och den rollen är det många
                  föräldrar saknar tid och självförtroende för utan stöd.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900 dark:text-stone-100">Passar det om vi redan har en privatlärare?</dt>
                <dd className="mt-1">
                  Ja, ofta kompletterande: läraren fokuserar på eleven; Föräldrahjälpen kan ge dig snabba förklaringar och överblick mellan tillfällena.
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-14 rounded-3xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/35 p-8 text-center shadow-[0_18px_40px_-24px_rgba(5,150,105,0.45)]">
          <p className="text-stone-800 dark:text-stone-100 font-medium mb-4">Redo att prova läxhjälp utifrån föräldraperspektiv?</p>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center justify-center px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-medium shadow-[0_18px_40px_-24px_rgba(5,150,105,0.65)] hover:bg-emerald-700 transition-all active:scale-[0.98]"
          >
            Kom igång gratis
          </button>
          <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
            Har du redan konto? Knappen tar dig till inloggning på{' '}
            <a href="/" className="text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
              startsidan
            </a>
            .
          </p>
        </div>

        {(onShowPrivacy || onShowTerms) && (
          <p className="mt-10 text-center text-xs text-stone-400 dark:text-stone-500">
            {onShowTerms && (
              <button type="button" onClick={onShowTerms} className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                {t('auth.termsOfService')}
              </button>
            )}
            {onShowTerms && onShowPrivacy && ' · '}
            {onShowPrivacy && (
              <button type="button" onClick={onShowPrivacy} className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                {t('auth.privacyPolicy')}
              </button>
            )}
          </p>
        )}
      </article>
    </div>
  );
}
