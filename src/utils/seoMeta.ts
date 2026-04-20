const SITE = 'https://foraldrahjalpen.se';

const HOME_TITLE = 'AI-läxhjälp för föräldrar | Föräldrahjälpen';
const HOME_DESCRIPTION =
  'AI-läxhjälp för föräldrar i grundskolan åk 1–9. Fota läxan, få förklaringar enligt Lgr22, läxplanering och bildanalys. Börja gratis på foraldrahjalpen.se.';

const LANDING_TITLE = 'Läxhjälp för föräldrar — vägledning, planering & Lgr22 | Föräldrahjälpen';
const LANDING_DESCRIPTION =
  'Läxhjälp för föräldrar med barn i grundskolan: förstå läxan, planera veckan och koppla till Lgr22. Jämfört med traditionell läxhjälp riktar sig Föräldrahjälpen till dig som förälder — börja gratis.';

function setMetaDescription(content: string) {
  let el = document.querySelector('meta[name="description"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'description');
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

export function applyHomeSeo() {
  document.title = HOME_TITLE;
  setMetaDescription(HOME_DESCRIPTION);
  setCanonical(`${SITE}/`);
}

export function applyParentLandingSeo() {
  document.title = LANDING_TITLE;
  setMetaDescription(LANDING_DESCRIPTION);
  setCanonical(`${SITE}/laxhjalp-foraldrar`);
}

export function applyTeacherLandingSeo() {
  document.title = 'AI-stöd för lärare — rätta, planera och förklara snabbare | Föräldrahjälpen';
  setMetaDescription(
    'AI-verktyg för lärare i grundskolan: rätta inlämningar, ge återkoppling kopplad till Lgr22 och skapa studieplaner snabbare. Prova gratis på foraldrahjalpen.se.',
  );
  setCanonical(`${SITE}/laxhjalp-larare`);
}
