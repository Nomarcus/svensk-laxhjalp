/**
 * API-URL:er för fetch.
 * - Utveckling: tom bas → relativa `/api/...` (Vite proxy → localhost:3001).
 * - Produktion: Cloud Run direkt så samma bygge fungerar på både Firebase (web.app) och Vercel (foraldrahjalpen.se).
 *   Överstyr med VITE_API_ORIGIN om tjänsten byter URL (Google Cloud → Cloud Run → laxhjalp-api).
 */
const CLOUD_RUN_API_ORIGIN = 'https://laxhjalp-api-288867992327.europe-west1.run.app';

export function apiUrl(path: string): string {
  const override = import.meta.env.VITE_API_ORIGIN?.trim();
  const base = (override || (import.meta.env.PROD ? CLOUD_RUN_API_ORIGIN : '')).replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
