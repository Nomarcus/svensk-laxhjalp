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
 * Ordningen vi försöker röster. Standard-rösterna är 4× billigare än Neural2
 * ($4/M tecken vs $16/M) och har större gratis-kvot från Google (4 M/mån vs 1 M/mån).
 * Sätt GOOGLE_TTS_USE_NEURAL=true om du vill försöka Neural2 först (t.ex. för Pro-användare).
 */
function voiceOrder(pref: { neural?: string; standard?: string }): string[] {
  const preferNeural = process.env.GOOGLE_TTS_USE_NEURAL === 'true';
  const order = preferNeural ? [pref.neural, pref.standard] : [pref.standard, pref.neural];
  return order.filter(Boolean) as string[];
}

export async function synthesizeMp3(apiKey: string, text: string, lang?: string): Promise<Buffer> {
  const key = resolveLang(lang);
  const pref = VOICE_PREF[key];
  const tryNames = voiceOrder(pref);

  let lastErr = '';
  for (const name of tryNames) {
    try {
      const res = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      return Buffer.from(data.audioContent, 'base64');
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(lastErr || 'Google TTS misslyckades');
}
