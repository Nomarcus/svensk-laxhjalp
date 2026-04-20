import React, { useEffect } from 'react';
import { Calculator, Camera, CheckCircle, Moon, Sigma, Sun } from 'lucide-react';
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
    q: 'Hur får jag mattehjälp online?',
    a: 'På Föräldrahjälpen kan du chatta eller fota matteläxan med mobilen. AI:n förklarar sedan uppgiften steg för steg, anpassat efter barnets årskurs i grundskolan — från enkel addition i åk 1 till ekvationer och algebra i åk 9.',
  },
  {
    q: 'Vilka matteområden täcks?',
    a: 'Alla områden i Lgr22: taluppfattning, de fyra räknesätten, bråk, decimaltal, procent, ekvationer, algebra, geometri, area, omkrets, volym, skala, statistik, sannolikhet, koordinater och funktioner.',
  },
  {
    q: 'Kan AI visa uträkningen?',
    a: 'Ja. Mattefrågor besvaras med tydliga steg — talet, uträkningen, och en pedagogisk förklaring av metoden. Du ser både svaret och hur man kommer dit, så barnet kan följa med i tänket.',
  },
  {
    q: 'Fungerar det för gymnasiematematik?',
    a: 'Verktyget är optimerat för grundskolans matematik (åk 1–9). För gymnasiet fungerar många frågor ändå, men läroplanskopplingen är mot Lgr22 och inte Gy11.',
  },
  {
    q: 'Kan barnet använda det själv?',
    a: 'Ja, men appen är byggd för föräldern som vuxen användare. Använd gärna Coach-läget så ger AI:n frågor du kan ställa till barnet istället för att avslöja svaret direkt.',
  },
];

const TOPICS_BY_GRADE: { grade: string; topics: string[] }[] = [
  { grade: 'Åk 1–3', topics: ['Talföljder upp till 1000', 'Addition och subtraktion', 'Klockan, mynt och sedlar', 'Enkla längder, vikt och volym', 'Geometriska former'] },
  { grade: 'Åk 4–6', topics: ['Multiplikation och division', 'Bråk och decimaltal', 'Procent och proportionalitet', 'Area, omkrets och volym', 'Koordinatsystem'] },
  { grade: 'Åk 7–9', topics: ['Ekvationer och algebra', 'Pythagoras sats', 'Geometri och vinkelsummor', 'Potenser och rotuttryck', 'Sannolikhet, statistik och funktioner'] },
];

export default function MatteLanding({
  onGetStarted,
  onShowPrivacy,
  onShowTerms,
  dark,
  onToggleDark,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const cleanupFaq = injectJsonLd('jsonld-matte-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
    const cleanupBreadcrumb = injectJsonLd('jsonld-matte-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Föräldrahjälpen', item: 'https://foraldrahjalpen.se/' },
        { '@type': 'ListItem', position: 2, name: 'Läxhjälp matte', item: 'https://foraldrahjalpen.se/laxhjalp-matte' },
      ],
    });
    const cleanupArticle = injectJsonLd('jsonld-matte-article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Läxhjälp matte åk 1–9 — mattehjälp online med AI',
      description: 'Mattehjälp online för hela grundskolan — från addition till algebra, kopplat till Lgr22.',
      inLanguage: 'sv-SE',
      author: { '@type': 'Organization', name: 'Föräldrahjälpen' },
      publisher: {
        '@type': 'Organization',
        name: 'Föräldrahjälpen',
        logo: { '@type': 'ImageObject', url: 'https://foraldrahjalpen.se/icon.svg' },
      },
      datePublished: '2026-02-01',
      dateModified: '2026-04-20',
      mainEntityOfPage: 'https://foraldrahjalpen.se/laxhjalp-matte',
      about: [
        { '@type': 'Thing', name: 'Matematik' },
        { '@type': 'Thing', name: 'Grundskolan' },
        { '@type': 'Thing', name: 'Lgr22' },
      ],
    });
    return () => {
      cleanupFaq();
      cleanupBreadcrumb();
      cleanupArticle();
    };
  }, []);

  return (
    <div className="min-h-screen app-soft-bg font-sans relative overflow-hidden text-stone-900 dark:text-stone-100">
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-amber-200/30 dark:bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-rose-200/20 dark:bg-rose-500/10 blur-3xl" />

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
          <a href="/" className="hover:text-amber-700 dark:hover:text-amber-400 underline underline-offset-2">
            Föräldrahjälpen
          </a>{' '}
          / <span className="text-stone-700 dark:text-stone-300">Läxhjälp matte</span>
        </nav>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
              <Calculator size={22} />
            </div>
            <a
              href="/"
              className="text-lg font-serif italic text-stone-900 dark:text-stone-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
            >
              {t('app.fullName')}
            </a>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-stone-900 dark:text-stone-100 leading-tight mb-4">
            Läxhjälp matte — mattehjälp online för åk 1 till 9
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            Fastnat på en matteuppgift? Föräldrahjälpen ger <strong className="font-medium text-stone-800 dark:text-stone-200">mattehjälp online</strong> direkt i
            mobilen. Fota uppgiften, ställ en fråga eller skriv in talet — AI:n förklarar metoden steg för steg, anpassad efter barnets årskurs i grundskolan och
            kopplad till <strong className="font-medium text-stone-800 dark:text-stone-200">Lgr22</strong>.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/85 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-100 dark:border-amber-800/50">
            <Sigma size={14} /> Alla räkneområden
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/85 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/50">
            <CheckCircle size={14} /> Lgr22
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50/85 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-full text-sm font-medium border border-rose-100 dark:border-rose-800/50">
            <Camera size={14} /> Fota läxan
          </span>
        </div>

        <div className="space-y-10 text-stone-700 dark:text-stone-300 leading-relaxed">
          <section aria-labelledby="sec-hur">
            <h2 id="sec-hur" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Så fungerar mattehjälpen
            </h2>
            <ol className="list-decimal pl-5 space-y-3 marker:text-amber-600 marker:font-bold">
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Fota eller skriv uppgiften.</strong> AI:n läser handskriven och tryckt matte —
                symboler, bråkstreck, geometriska figurer och tabeller.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Få en steg-för-steg-förklaring.</strong> Varje steg visas tydligt med en kort
                pedagogisk kommentar: varför man gör det, inte bara hur.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Kontrollera svaret.</strong> Facit finns tillgängligt, och du kan be om en
                alternativ metod om den första inte passar barnets skolbok.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Följ upp med Coach-läget.</strong> Låt AI:n ge dig frågor att ställa till barnet
                så hen själv kommer fram till svaret.
              </li>
            </ol>
          </section>

          <section aria-labelledby="sec-arskurser">
            <h2 id="sec-arskurser" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Mattehjälp per årskurs
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {TOPICS_BY_GRADE.map((group) => (
                <div
                  key={group.grade}
                  className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-white/60 dark:bg-slate-900/40 p-4"
                >
                  <h3 className="font-medium text-stone-900 dark:text-stone-100 mb-2">{group.grade}</h3>
                  <ul className="text-sm text-stone-600 dark:text-stone-400 space-y-1 list-disc pl-5 marker:text-amber-600">
                    {group.topics.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="sec-exempel">
            <h2 id="sec-exempel" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Exempel på frågor
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-amber-600">
              <li>&quot;Hur räknar man ut 7 × 8?&quot; → AI:n visar bygg-från-känd-metoden: 7 × 7 = 49, sedan + 7 = 56.</li>
              <li>&quot;Hur förkortar man bråket 12/18?&quot; → AI:n förklarar största gemensamma delaren och visar vägen: 12/18 = 2/3.</li>
              <li>&quot;Vad är area-formeln för triangel?&quot; → AI:n ger formeln, visar ett exempel och kopplar till geometri-målet i Lgr22.</li>
              <li>&quot;Lös ekvationen 2x + 5 = 17&quot; → AI:n visar hur man flyttar termer och dividerar steg för steg.</li>
              <li>&quot;Vad är Pythagoras sats?&quot; → AI:n förklarar rätvinkliga trianglar med exempel och illustration.</li>
            </ul>
          </section>

          <section aria-labelledby="sec-foralder">
            <h2 id="sec-foralder" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Mattehjälp för föräldrar som inte räknat på länge
            </h2>
            <p className="mb-4">
              Matte har ändrats sedan vi själva gick i skolan. Tallinjer, areamodeller och positionssystem är exempel på metoder i nuvarande läroplan. Med
              Föräldrahjälpen kan du snabbt förstå hur barnet förväntas lösa uppgiften — så du slipper säga &quot;så här gjorde vi på min tid&quot;.
            </p>
            <p>
              Se även{' '}
              <a href="/laxhjalp-foraldrar" className="text-amber-700 dark:text-amber-400 underline underline-offset-2">
                läxhjälp för föräldrar
              </a>{' '}
              och{' '}
              <a href="/ai-laxhjalp" className="text-amber-700 dark:text-amber-400 underline underline-offset-2">
                AI-läxhjälp
              </a>{' '}
              för en översikt av alla ämnen.
            </p>
          </section>

          <section aria-labelledby="sec-faq">
            <h2 id="sec-faq" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Vanliga frågor om läxhjälp matte
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

        <div className="mt-14 rounded-3xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/35 p-8 text-center shadow-[0_18px_40px_-24px_rgba(217,119,6,0.4)]">
          <p className="text-stone-800 dark:text-stone-100 font-medium mb-4">Fastnat på matteläxan? Fota den och få den förklarad.</p>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-amber-600 text-white rounded-2xl font-medium shadow-[0_18px_40px_-24px_rgba(217,119,6,0.55)] hover:bg-amber-700 transition-all active:scale-[0.98]"
          >
            <Camera size={18} /> Kom igång gratis
          </button>
        </div>

        {(onShowPrivacy || onShowTerms) && (
          <p className="mt-10 text-center text-xs text-stone-400 dark:text-stone-500">
            {onShowTerms && (
              <button type="button" onClick={onShowTerms} className="underline hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                {t('auth.termsOfService')}
              </button>
            )}
            {onShowTerms && onShowPrivacy && ' · '}
            {onShowPrivacy && (
              <button type="button" onClick={onShowPrivacy} className="underline hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                {t('auth.privacyPolicy')}
              </button>
            )}
          </p>
        )}
      </article>
    </div>
  );
}
