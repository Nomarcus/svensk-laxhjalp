/** SEO-vänlig ASCII-slug; Firebase rewrite skickar alla paths till index.html. */
export const LAXHJALP_FORALDRAR_PATH = '/laxhjalp-foraldrar';

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}
