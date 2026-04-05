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

export async function synthesizeMp3(apiKey: string, text: string, lang?: string): Promise<Buffer> {
  const key = resolveLang(lang);
  const pref = VOICE_PREF[key];
  const tryNames = [pref.neural, pref.standard].filter(Boolean) as string[];

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
