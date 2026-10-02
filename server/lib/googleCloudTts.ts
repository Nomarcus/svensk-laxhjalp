import admin from 'firebase-admin';
import { createHash } from 'crypto';

export type TtsLangKey = 'sv' | 'en' | 'ar';

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const VOICE_PREF: Record<TtsLangKey, { languageCode: string; neural?: string; standard?: string }> = {
  sv: { languageCode: 'sv-SE', neural: 'sv-SE-Neural2-A', standard: 'sv-SE-Standard-A' },
  en: { languageCode: 'en-US', neural: 'en-US-Neural2-F', standard: 'en-US-Standard-F' },
  ar: { languageCode: 'ar-XA', neural: 'ar-XA-Neural2-A', standard: 'ar-XA-Standard-A' },
};

function resolveLang(lang: string | undefined): TtsLangKey {
  if (lang?.startsWith('en')) return 'en';
  if (lang?.startsWith('ar')) return 'ar';
  return 'sv';
}

/**
 * Neural2 först: Standard-rösterna låter som en gammal talsyntes. Neural2 kostar mer
 * per tecken, men appen läser bara upp den korta rutan till barnet och cachar ljudet.
 * GOOGLE_TTS_USE_NEURAL=false går tillbaka till Standard först.
 */
function voiceOrder(pref: { neural?: string; standard?: string }): string[] {
  const preferNeural = process.env.GOOGLE_TTS_USE_NEURAL !== 'false';
  const order = preferNeural ? [pref.neural, pref.standard] : [pref.standard, pref.neural];
  return order.filter(Boolean) as string[];
}

/**
 * Utan API-nyckel används Cloud Run-tjänstens eget servicekonto. Då behövs bara att
 * Text-to-Speech-API:t är påslaget i projektet, ingen nyckel att hantera.
 */
async function authFor(apiKey: string): Promise<{ url: string; headers: Record<string, string> }> {
  if (apiKey) return { url: `${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, headers: {} };
  const token = await admin.credential.applicationDefault().getAccessToken();
  return { url: TTS_ENDPOINT, headers: { Authorization: `Bearer ${token.access_token}` } };
}

/** Samma text läses ofta igen (två tryck, samma uppgift). Liten cache i minnet. */
const CACHE_MAX = 300;
const cache = new Map<string, Buffer>();

export async function synthesizeMp3(apiKey: string, text: string, lang?: string): Promise<Buffer> {
  const key = resolveLang(lang);
  const pref = VOICE_PREF[key];
  const tryNames = voiceOrder(pref);
  const cacheKey = createHash('sha256').update(`${key}|${tryNames[0]}|${text}`).digest('hex');
  const hit = cache.get(cacheKey);
  if (hit) {
    cache.delete(cacheKey);
    cache.set(cacheKey, hit);
    return hit;
  }
  const auth = await authFor(apiKey);

  let lastErr = '';
  for (const name of tryNames) {
    try {
      const res = await fetch(auth.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.headers },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: pref.languageCode,
            name,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.95,
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastErr = errBody || res.statusText;
        continue;
      }

      const data = (await res.json()) as { audioContent?: string };
      if (!data.audioContent) {
        lastErr = 'Saknar ljuddata';
        continue;
      }
      const audio = Buffer.from(data.audioContent, 'base64');
      cache.set(cacheKey, audio);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      return audio;
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(lastErr || 'Google TTS misslyckades');
}
