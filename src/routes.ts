/** SEO-vänlig ASCII-slug; Firebase rewrite skickar alla paths till index.html. */
export const LAXHJALP_FORALDRAR_PATH = '/laxhjalp-foraldrar';
export const LAXHJALP_LARARE_PATH = '/laxhjalp-larare';

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}
