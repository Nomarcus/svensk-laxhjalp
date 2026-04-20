/**
 * Per-route SEO-helpers. Sätter title, description, canonical, OG- och Twitter-tags
 * samt robots-hints för varje sida. Ger Google tydligare signaler per URL än
 * en statisk <head> kan göra för en SPA.
 */
const SITE = 'https://foraldrahjalpen.se';
const DEFAULT_OG_IMAGE = `${SITE}/icon.svg`;

interface SeoInput {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  keywords?: string;
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Injicerar JSON-LD schema i <head> med ett id så vi kan plocka bort igen när
 * användaren navigerar bort. Samma id ersätter istället för att duplicera.
 */
export function injectJsonLd(id: string, data: object): () => void {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.text = JSON.stringify(data);
  document.head.appendChild(script);
  return () => {
    const el = document.getElementById(id);
    if (el) el.remove();
  };
}

function applySeo(input: SeoInput) {
  const url = `${SITE}${input.path}`;
  document.title = input.title;
  setMeta('description', input.description);
  setCanonical(url);

  if (input.keywords) setMeta('keywords', input.keywords);

  // Open Graph
  setMeta('og:type', input.ogType || 'website', 'property');
  setMeta('og:title', input.title, 'property');
  setMeta('og:description', input.description, 'property');
  setMeta('og:url', url, 'property');
  setMeta('og:image', input.ogImage || DEFAULT_OG_IMAGE, 'property');
  setMeta('og:site_name', 'Föräldrahjälpen', 'property');
  setMeta('og:locale', 'sv_SE', 'property');

  // Twitter
  setMeta('twitter:card', 'summary');
  setMeta('twitter:title', input.title);
  setMeta('twitter:description', input.description);
  setMeta('twitter:image', input.ogImage || DEFAULT_OG_IMAGE);
}

export function applyHomeSeo() {
  applySeo({
    title: 'AI-läxhjälp för föräldrar | Föräldrahjälpen',
    description:
      'AI-läxhjälp för föräldrar i grundskolan åk 1–9. Fota läxan, få förklaringar enligt Lgr22, läxplanering och bildanalys. Börja gratis på foraldrahjalpen.se.',
    path: '/',
    keywords:
      'läxhjälp, läxhjälpen, läxhjälp online, AI-läxhjälp, läxhjälp föräldrar, läxhjälp grundskolan, läxhjälp matte, läxhjälp svenska, läxhjälp engelska, Lgr22, skola, AI skola, hjälp med läxor, läxplanering',
  });
}

export function applyParentLandingSeo() {
  applySeo({
    title: 'Läxhjälp för föräldrar — vägledning, planering & Lgr22 | Föräldrahjälpen',
    description:
      'Läxhjälp för föräldrar med barn i grundskolan: förstå läxan, planera veckan och koppla till Lgr22. Jämfört med traditionell läxhjälp riktar sig Föräldrahjälpen till dig som förälder — börja gratis.',
    path: '/laxhjalp-foraldrar',
    keywords:
      'läxhjälp föräldrar, läxhjälp hem, läxhjälp åk 1, läxhjälp åk 9, hjälpa barn med läxor, pedagogisk läxhjälp, Lgr22, grundskolan',
  });
}

export function applyTeacherLandingSeo() {
  applySeo({
    title: 'AI-stöd för lärare — rätta, planera och förklara snabbare | Föräldrahjälpen',
    description:
      'AI-verktyg för lärare i grundskolan: rätta inlämningar, ge återkoppling kopplad till Lgr22 och skapa studieplaner snabbare. Prova gratis på foraldrahjalpen.se.',
    path: '/laxhjalp-larare',
    keywords:
      'AI för lärare, AI i skolan, rätta inlämningar, återkoppling, bedömningsstöd, Lgr22, studieplan, svensk grundskola, lärarverktyg',
  });
}

export function applyAiLaxhjalpSeo() {
  applySeo({
    title: 'AI-läxhjälp — chatta, fota och förstå läxan | Föräldrahjälpen',
    description:
      'AI-läxhjälp på svenska för hela grundskolan. Fota läxan och få den förklarad steg för steg enligt Lgr22. Snabbare än ChatGPT för skolan — prova gratis.',
    path: '/ai-laxhjalp',
    keywords:
      'AI-läxhjälp, AI läxhjälp, AI skola, ChatGPT läxor, AI hjälp läxor, AI förklaring, Gemini läxor, AI grundskolan, AI i skolan, artificiell intelligens skola',
  });
}

export function applyMatteSeo() {
  applySeo({
    title: 'Läxhjälp matte åk 1–9 — mattehjälp online med AI | Föräldrahjälpen',
    description:
      'Mattehjälp online för hela grundskolan — från addition till algebra. Fota matteläxan och få förklaringar steg för steg. Gratis att börja på foraldrahjalpen.se.',
    path: '/laxhjalp-matte',
    keywords:
      'läxhjälp matte, mattehjälp, mattehjälp online, matematik läxhjälp, matte åk 1, matte åk 6, matte åk 9, bråk, ekvationer, geometri, algebra, AI matte',
  });
}

export function applyOnlineSeo() {
  applySeo({
    title: 'Läxhjälp online — gratis hjälp med läxor på nätet | Föräldrahjälpen',
    description:
      'Läxhjälp online när du behöver den. Chatta eller fota läxan och få pedagogiska förklaringar kopplade till Lgr22. Fungerar på mobil, surfplatta och dator.',
    path: '/laxhjalp-online',
    keywords:
      'läxhjälp online, läxhjälp på nätet, gratis läxhjälp, läxhjälp mobil, digital läxhjälp, läxhjälp internet, läxhjälp webb',
  });
}
