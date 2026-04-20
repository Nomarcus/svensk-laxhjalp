/** SEO-vänlig ASCII-slug; Firebase rewrite skickar alla paths till index.html. */
export const LAXHJALP_FORALDRAR_PATH = '/laxhjalp-foraldrar';
export const LAXHJALP_LARARE_PATH = '/laxhjalp-larare';
export const AI_LAXHJALP_PATH = '/ai-laxhjalp';
export const LAXHJALP_MATTE_PATH = '/laxhjalp-matte';
export const LAXHJALP_ONLINE_PATH = '/laxhjalp-online';

export const LANDING_PATHS = [
  LAXHJALP_FORALDRAR_PATH,
  LAXHJALP_LARARE_PATH,
  AI_LAXHJALP_PATH,
  LAXHJALP_MATTE_PATH,
  LAXHJALP_ONLINE_PATH,
];

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}
