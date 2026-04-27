import React, { useEffect } from 'react';
import { Bot, BookOpen, Camera, CheckCircle, Moon, Sparkles, Sun } from 'lucide-react';
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
    q: 'Vad är AI-läxhjälp?',
    a: 'AI-läxhjälp är ett digitalt verktyg som använder artificiell intelligens för att förklara läxor steg för steg. Föräldrahjälpen är byggd för svensk grundskola och kopplar varje förklaring till läroplanen Lgr22, så du får rätt nivå för barnets årskurs.',
  },
  {
    q: 'Vad är skillnaden mot ChatGPT?',
    a: 'ChatGPT är ett generellt AI-verktyg utan kunskap om svensk skola. Föräldrahjälpen är förinställd för Lgr22, åk 1–9 och pedagogisk ton — du behöver inte skriva promptar eller förklara vad eleven är i för årskurs.',
  },
  {
    q: 'Är AI-läxhjälp fusk?',
    a: 'Nej, inte om det används rätt. AI-läxhjälpen förklarar uppgifter så att föräldern förstår och kan vägleda barnet. Med Coach-läge ställer AI:n motfrågor till barnet istället för att ge färdiga svar — precis som en bra lärare gör.',
  },
  {
    q: 'Fungerar AI-läxhjälp för alla ämnen?',
    a: 'Ja. Föräldrahjälpen stödjer matematik, svenska, engelska, NO (biologi, fysik, kemi), SO (historia, geografi, samhällskunskap, religion) och moderna språk. AI:n är tränad på svensk grundskolas innehåll.',
  },
  {
    q: 'Kan AI analysera foton av läxan?',
    a: 'Ja. Fota uppgiften med mobilen — AI:n läser handskriven och tryckt text och ger en pedagogisk förklaring. Perfekt för arbetsblad, stenciler och läroboksuppgifter där du inte orkar skriva av allt.',
  },
];

export default function AiLaxhjalpLanding({
  onGetStarted,
  onShowPrivacy,
  onShowTerms,
  dark,
  onToggleDark,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const cleanupFaq = injectJsonLd('jsonld-ai-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
    const cleanupBreadcrumb = injectJsonLd('jsonld-ai-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Föräldrahjälpen', item: 'https://foraldrahjalpen.se/' },
        { '@type': 'ListItem', position: 2, name: 'AI-läxhjälp', item: 'https://foraldrahjalpen.se/ai-laxhjalp' },
      ],
    });
    const cleanupArticle = injectJsonLd('jsonld-ai-article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'AI-läxhjälp — chatta, fota och förstå läxan',
      description: 'AI-läxhjälp på svenska för hela grundskolan, kopplat till Lgr22.',
      inLanguage: 'sv-SE',
      author: { '@type': 'Organization', name: 'Föräldrahjälpen' },
      publisher: {
        '@type': 'Organization',
        name: 'Föräldrahjälpen',
        logo: { '@type': 'ImageObject', url: 'https://foraldrahjalpen.se/icon.svg' },
      },
      datePublished: '2026-02-01',
      dateModified: '2026-04-20',
      mainEntityOfPage: 'https://foraldrahjalpen.se/ai-laxhjalp',
    });
    return () => {
      cleanupFaq();
      cleanupBreadcrumb();
      cleanupArticle();
    };
  }, []);

  return (
    <div className="min-h-screen app-soft-bg font-sans relative overflow-hidden text-stone-900 dark:text-stone-100">
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-indigo-200/30 dark:bg-indigo-500/10 blur-3xl" />
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
        <nav aria-label="Brödsmulor" className="mb-6 text-sm text-stone-500 dark:text-stone-400">
          <a href="/" className="hover:text-emerald-700 dark:hover:text-emerald-400 underline underline-offset-2">
            Föräldrahjälpen
          </a>{' '}
          / <span className="text-stone-700 dark:text-stone-300">AI-läxhjälp</span>
        </nav>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={22} />
            </div>
            <a
              href="/"
              className="text-lg font-serif italic text-stone-900 dark:text-stone-100 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors"
            >
              {t('app.fullName')}
            </a>
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-stone-900 dark:text-stone-100 leading-tight mb-4">
            AI-läxhjälp för svensk grundskola — från ChatGPT-promptar till färdig förklaring
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            Föräldrahjälpen är en <strong className="font-medium text-stone-800 dark:text-stone-200">AI-läxhjälp</strong> byggd för svensk skola. Istället för att
            skriva långa promptar i ChatGPT får du svar direkt, på rätt nivå, kopplat till <strong className="font-medium text-stone-800 dark:text-stone-200">Lgr22</strong>.
            AI:n (Google Gemini) förstår både text och bild — fota läxan, ställ frågan och få den förklarad steg för steg.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/85 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium border border-indigo-100 dark:border-indigo-800/50">
            <Bot size={14} /> Gemini AI
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/85 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/50">
            <CheckCircle size={14} /> Lgr22
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/85 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800/50">
            <BookOpen size={14} /> Åk 1–9
          </span>
        </div>

        <div className="space-y-10 text-stone-700 dark:text-stone-300 leading-relaxed">
          <section aria-labelledby="sec-vad">
            <h2 id="sec-vad" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Vad är AI-läxhjälp?
            </h2>
            <p className="mb-4">
              AI-läxhjälp betyder att artificiell intelligens förklarar läxuppgifter pedagogiskt steg för steg. Under de senaste åren har generella AI-verktyg som
              ChatGPT, Claude och Gemini blivit populära för att få snabba svar — men de är inte byggda för svensk skola. Föräldrahjälpen är specialiserad för
              grundskolan och använder Gemini i botten, inställt med kunskap om läroplanen Lgr22, svenska årskurser och pedagogisk ton.
            </p>
            <p>
              Det betyder att du slipper skriva promptar som &quot;förklara som om jag är 9 år gammal och utgå från svenska Lgr22&quot; — det är redan inbyggt.
            </p>
          </section>

          <section aria-labelledby="sec-hur">
            <h2 id="sec-hur" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Så fungerar AI-läxhjälpen
            </h2>
            <ul className="list-disc pl-5 space-y-3 marker:text-indigo-600">
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Chatta</strong> — ställ en fråga som &quot;Hur löser man 7 × 8?&quot; eller
                &quot;Vad är fotosyntes?&quot; och få en förklaring anpassad efter barnets årskurs.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Fota läxan</strong> — ta en bild av arbetsbladet med mobilen, AI:n läser både
                handskrift och tryckt text.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Coach-läge</strong> — AI:n ger dig motfrågor att ställa till barnet istället
                för färdiga svar. En pedagogisk variant som bygger förståelse.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Illustrationer</strong> — AI-genererade bilder förklarar visuella begrepp som
                cellens delar, skalenligt, eller bråktalets geometri.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Uppläsning</strong> — lyssna på svaret med en naturlig svensk röst, bra för
                dyslexi eller när man pluggar i bilen.
              </li>
            </ul>
          </section>

          <section aria-labelledby="sec-amnen">
            <h2 id="sec-amnen" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              AI-läxhjälp för alla ämnen i grundskolan
            </h2>
            <p className="mb-4">
              AI:n är tränad på hela bredden av ämnen i svensk grundskola. Några exempel på vad du kan få hjälp med:
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-indigo-600">
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Matte</strong> — från enkel addition i åk 1 till ekvationer och algebra i åk 9.
                Se <a href="/laxhjalp-matte" className="text-indigo-700 dark:text-indigo-400 underline underline-offset-2">mattehjälp online</a>.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Svenska</strong> — grammatik, uppsatsskrivning, textanalys, stavning och
                läsförståelse.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">Engelska och moderna språk</strong> — glosor, översättning, textanalys och
                grammatik.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">NO</strong> — biologi, fysik, kemi och teknik.
              </li>
              <li>
                <strong className="font-medium text-stone-800 dark:text-stone-200">SO</strong> — historia, geografi, samhällskunskap och religion.
              </li>
            </ul>
          </section>

          <section aria-labelledby="sec-skillnad">
            <h2 id="sec-skillnad" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              AI-läxhjälp vs ChatGPT
            </h2>
            <p className="mb-4">
              Både ChatGPT, Claude och Gemini kan ge bra svar om man vet hur man frågar. Skillnaden med en dedikerad AI-läxhjälp är att detaljerna är lösta:
              svensk språkton, anpassning efter grundskolans årskurser, och att varje svar länkas till det centrala innehållet i Lgr22. Du behöver inte vara
              AI-expert — du skriver frågan som den ser ut i läxboken.
            </p>
            <p>
              Dessutom: med bildanalys kan du fota uppgifter direkt, medan ChatGPT kräver att du skriver av allt eller laddar upp bilder i ett separat flöde.
            </p>
          </section>

          <section aria-labelledby="sec-foralder">
            <h2 id="sec-foralder" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              AI som hjälper föräldern — inte gör läxan åt barnet
            </h2>
            <p className="mb-4">
              Coach-läget är byggt för den förälder som undrar &quot;Gör jag bara läxan åt barnet?&quot;. Istället för att ge svaret ger AI:n dig frågor att ställa
              till barnet, så barnet själv kommer fram till lösningen. Det är sokratisk metod — samma teknik som bra lärare använder vid tavlan.
            </p>
            <p>
              <a href="/laxhjalp-foraldrar" className="text-indigo-700 dark:text-indigo-400 underline underline-offset-2">
                Läs mer om läxhjälp för föräldrar
              </a>
              .
              {/* eller{' '}
              <a href="/laxhjalp-larare" className="text-indigo-700 dark:text-indigo-400 underline underline-offset-2">
                AI-stöd för lärare
              </a> */}
            </p>
          </section>

          <section aria-labelledby="sec-faq">
            <h2 id="sec-faq" className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">
              Vanliga frågor om AI-läxhjälp
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

        <div className="mt-14 rounded-3xl border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/60 dark:bg-indigo-950/35 p-8 text-center shadow-[0_18px_40px_-24px_rgba(79,70,229,0.45)]">
          <p className="text-stone-800 dark:text-stone-100 font-medium mb-4">Prova AI-läxhjälpen gratis — inget kort krävs</p>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-medium shadow-[0_18px_40px_-24px_rgba(79,70,229,0.65)] hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            <Camera size={18} /> Kom igång gratis
          </button>
        </div>

        {(onShowPrivacy || onShowTerms) && (
          <p className="mt-10 text-center text-xs text-stone-400 dark:text-stone-500">
            {onShowTerms && (
              <button type="button" onClick={onShowTerms} className="underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {t('auth.termsOfService')}
              </button>
            )}
            {onShowTerms && onShowPrivacy && ' · '}
            {onShowPrivacy && (
              <button type="button" onClick={onShowPrivacy} className="underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {t('auth.privacyPolicy')}
              </button>
            )}
          </p>
        )}
      </article>
    </div>
  );
}
