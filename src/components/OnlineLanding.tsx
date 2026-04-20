import React, { useEffect } from 'react';
import { CheckCircle, Globe, Moon, Smartphone, Sun, Wifi } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { injectJsonLd } from '../utils/seoMeta';

interface Props {
  onGetStarted: () => void;
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Är läxhjälp online gratis?',
    a: 'Ja, på Föräldrahjälpen är det gratis att börja — 5 AI-svar och 2 bildanalyser per dag. Vill du ha obegränsad läxhjälp online kostar full version 49 kr/mån och du kan säga upp när som helst.',
  },
  {
    q: 'Behöver jag installera en app?',
    a: 'Nej. Föräldrahjälpen fungerar direkt i webbläsaren på mobil, surfplatta och dator. Vill du ha appen på hemskärmen kan du installera den som PWA — ingen App Store eller Google Play behövs.',
  },
  {
    q: 'Fungerar läxhjälpen utan internet?',
    a: 'AI-svaren kräver internet eftersom de genereras i molnet. Men tidigare sparade förklaringar kan läsas offline via resursbiblioteket.',
  },
  {
    q: 'Vilka språk stöds?',
    a: 'Svenska är huvudspråk. Appen finns även på engelska och arabiska (beta) för familjer där ett annat språk talas hemma.',
  },
];

export default function OnlineLanding({
  onGetStarted,
  onShowPrivacy,
  onShowTerms,
  dark,
  onToggleDark,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const cleanupFaq = injectJsonLd('jsonld-online-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
    const cleanupBreadcrumb = injectJsonLd('jsonld-online-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Föräldrahjälpen', item: 'https://foraldrahjalpen.se/' },
        { '@type': 'ListItem', position: 2, name: 'Läxhjälp online', item: 'https://foraldrahjalpen.se/laxhjalp-online' },
      ],
    });
    const cleanupArticle = injectJsonLd('jsonld-online-article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Läxhjälp online — gratis hjälp med läxor på nätet',
      description: 'Läxhjälp online: chatta eller fota läxan och få pedagogiska förklaringar enligt Lgr22 direkt i mobilen.',
      inLanguage: 'sv-SE',
      author: { '@type': 'Organization', name: 'Föräldrahjälpen' },
      publisher: {
        '@type': 'Organization',
        name: 'Föräldrahjälpen',
        logo: { '@type': 'ImageObject', url: 'https://foraldrahjalpen.se/icon.svg' },
      },
      datePublished: '2026-02-01',
      dateModified: '2026-04-20',
      mainEntityOfPage: 'https://foraldrahjalpen.se/laxhjalp-online',
    });
    return () => {
      cleanupFaq();
      cleanupBreadcrumb();
      cleanupArticle();
    };
  }, []);

  return (
    <div className="min-h-screen app-soft-bg font-sans relative overflow-hidden text-stone-900 dark:text-stone-100">
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-teal-200/30 dark:bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-sky-200/20 dark:bg-sky-500/10 blur-3xl" />

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
        <nav aria-label="Brödsmulor" className="mb-6 text-sm text-stone-500 dark:text-stone-400">
          <a href="/" className="hover:text-teal-700 dark:hover:text-teal-400 underline underline-offset-2">
            Föräldrahjälpen
          </a>{' '}
          / <span className="text-stone-700 dark:text-stone-300">Läxhjälp online</span>
        </nav>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-200">
              <Globe size={22} />
            </div>
            <a
              href="/"
              className="text-lg font-serif italic text-stone-900 dark:text-stone-100 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
            >
              {t('app.fullName')}
            </a>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-stone-900 dark:text-stone-100 leading-tight mb-4">
            Läxhjälp online — gratis hjälp med läxor direkt i mobilen
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            Söker du <strong className="font-medium text-stone-800 dark:text-stone-200">läxhjälp online</strong>? Föräldrahjälpen fungerar direkt i webbläsaren —
            ingen app att ladda ner, inget krångel. Fota läxan, ställ en fråga och få en förklaring kopplad till Lgr22. Gratis att börja, 49 kr/mån för obegränsad
            användning.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50/85 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 rounded-full text-sm font-medium border border-teal-100 dark:border-teal-800/50">
            <Smartphone size={14} /> Mobil, surfplatta, dator
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50/85 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-full text-sm font-medium border border-sky-100 dark:border-sky-800/50">
            <Wifi size={14} /> Ingen app behövs
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/85 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/50">
            <CheckCircle size={14} /> Gratis att börja
          </span>
        </div>

        <div className="space-y-10 text-stone-700 dark:text-stone-300 leading-relaxed">
          <section aria-labelledby="sec-varfor">
            <h2 id="sec-varfor" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Varför läxhjälp online?
            </h2>
            <p>
              Läxhjälp på nätet har flera fördelar jämfört med bokade lektioner hemma eller hos privatlärare: du får hjälp precis när frågan dyker upp — vid
              middagsbordet, på bussen hem från träningen, eller kvällen innan provet. Ingen väntan, ingen bokning. Du betalar bara för den hjälp du faktiskt
              använder.
            </p>
          </section>

          <section aria-labelledby="sec-funktioner">
            <h2 id="sec-funktioner" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Funktioner i läxhjälp-appen
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-teal-600">
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Chatta med AI</strong> — svar på sekunder, skräddarsytt efter barnets årskurs.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Fota läxan</strong> — AI:n läser både tryckt och handskriven text.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Läxplanering</strong> — kalender med inlämningsdagar och arbetspass, delbar med
                andra föräldern.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Resursbibliotek</strong> — spara bra förklaringar och läs dem igen senare.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Coach-läge</strong> — få frågor att ställa till barnet istället för färdiga svar.
              </li>
            </ul>
          </section>

          <section aria-labelledby="sec-enheter">
            <h2 id="sec-enheter" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Fungerar på alla enheter
            </h2>
            <p className="mb-4">
              Föräldrahjälpen är byggd som en PWA (Progressive Web App) — det betyder att den fungerar i vanliga webbläsare men kan installeras på hemskärmen som
              en vanlig app. Inga uppdateringar från App Store, ingen filstorlek att oroa sig för.
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-teal-600">
              <li>iPhone och iPad (Safari) — tryck &quot;Lägg till på hemskärmen&quot;.</li>
              <li>Android (Chrome) — tryck &quot;Installera app&quot; när det dyker upp.</li>
              <li>Windows, Mac och Linux — fungerar i valfri webbläsare.</li>
            </ul>
          </section>

          <section aria-labelledby="sec-amnen">
            <h2 id="sec-amnen" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Läxhjälp online för alla ämnen
            </h2>
            <p>
              Få hjälp med <a href="/laxhjalp-matte" className="text-teal-700 dark:text-teal-400 underline underline-offset-2">matte</a>, svenska, engelska, NO, SO
              och moderna språk. Se även{' '}
              <a href="/ai-laxhjalp" className="text-teal-700 dark:text-teal-400 underline underline-offset-2">AI-läxhjälp</a> för en djupdykning i hur AI:n
              fungerar, eller <a href="/laxhjalp-foraldrar" className="text-teal-700 dark:text-teal-400 underline underline-offset-2">läxhjälp för föräldrar</a>
              {' '}för ett föräldraperspektiv.
            </p>
          </section>

          <section aria-labelledby="sec-faq">
            <h2 id="sec-faq" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Vanliga frågor om läxhjälp online
            </h2>
            <dl className="space-y-4">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-medium text-stone-900 dark:text-stone-100">{item.q}</dt>
                  <dd className="mt-1">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="mt-14 rounded-3xl border border-teal-200/80 dark:border-teal-800/50 bg-teal-50/60 dark:bg-teal-950/35 p-8 text-center shadow-[0_18px_40px_-24px_rgba(13,148,136,0.4)]">
          <p className="text-stone-800 dark:text-stone-100 font-medium mb-4">Redo att prova läxhjälp online? Gratis att börja.</p>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center justify-center px-8 py-3.5 bg-teal-600 text-white rounded-2xl font-medium shadow-[0_18px_40px_-24px_rgba(13,148,136,0.55)] hover:bg-teal-700 transition-all active:scale-[0.98]"
          >
            Kom igång gratis
          </button>
        </div>

        {(onShowPrivacy || onShowTerms) && (
          <p className="mt-10 text-center text-xs text-stone-400 dark:text-stone-500">
            {onShowTerms && (
              <button type="button" onClick={onShowTerms} className="underline hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                {t('auth.termsOfService')}
              </button>
            )}
            {onShowTerms && onShowPrivacy && ' · '}
            {onShowPrivacy && (
              <button type="button" onClick={onShowPrivacy} className="underline hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                {t('auth.privacyPolicy')}
              </button>
            )}
          </p>
        )}
      </article>
    </div>
  );
}
