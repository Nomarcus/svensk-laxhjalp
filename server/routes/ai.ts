import { Router, Response } from 'express';
import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  normalizeAndTrimHistory,
  normalizeImageGenerationPrompt,
  normalizePrompt,
  validateInlineImages,
} from '../lib/chatRequestValidation';
import { MULTI_EXERCISE_IMAGE_INSTRUCTION, MULTI_EXERCISE_IMAGE_INSTRUCTION_COACH } from '../lib/homeworkImageChatHints';

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gemini-2.5-flash-lite';
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const PROMPT_CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000;

type PromptCacheEntry = { cachedContentName: string; expiresAtMs: number };
const promptCacheByBucket = new Map<string, PromptCacheEntry>();
const imageAnalysisCache = new Map<string, { text: string; usage: unknown; expiresAtMs: number }>();

function parseGradeLevel(raw?: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 12 ? n : null;
}

function buildAudienceGuidance(rawGrade?: unknown): string {
  const grade = parseGradeLevel(rawGrade);
  if (grade === null) {
    return 'Neutral nivå: tydligt men inte barnsligt språk. Undvik överförenkling.';
  }
  if (grade <= 3) {
    return 'Lågstadium: enkel och varm ton, mycket konkreta exempel, lekfull pedagogik.';
  }
  if (grade <= 6) {
    return 'Mellanstadium: tydlig och coachande ton, konkreta exempel, mindre lekfullt.';
  }
  if (grade <= 9) {
    return 'Högstadium: mer mogen ton, rak och respektfull, ämneskorrekt terminologi.';
  }
  return 'Gymnasienivå: vuxnare ton, precision och struktur, undvik barnsliga metaforer.';
}

function gradeBucket(rawGrade?: unknown): string {
  const grade = parseGradeLevel(rawGrade);
  if (grade === null) return 'neutral';
  if (grade <= 3) return 'low';
  if (grade <= 6) return 'mid';
  if (grade <= 9) return 'high';
  return 'gymnasium';
}

async function getOrCreatePromptCache(
  model: string,
  bucket: string,
  systemInstruction: string,
): Promise<string | null> {
  const key = `${model}|${bucket}`;
  const now = Date.now();
  const hit = promptCacheByBucket.get(key);
  if (hit && hit.expiresAtMs > now) return hit.cachedContentName;

  try {
    const api = ai as unknown as {
      caches?: { create: (args: Record<string, unknown>) => Promise<{ name?: string }> };
    };
    if (!api.caches?.create) return null;

    const cache = await api.caches.create({
      model,
      config: {
        systemInstruction,
        ttl: '3600s',
      },
    });
    const name = cache?.name;
    if (!name) return null;
    promptCacheByBucket.set(key, { cachedContentName: name, expiresAtMs: now + PROMPT_CACHE_TTL_MS });
    return name;
  } catch {
    return null;
  }
}

const SYSTEM_INSTRUCTION = `
Du hjälper svenska föräldrar med barnens läxor. Skriv på svenska, kort och konkret.
Målgrupp: förälder (inte elev), med praktiska råd för hemmet.

Krav i varje svar:
1) Förklara uppgiften steg för steg.
2) Avsluta alltid med **Så kan du förklara för ditt barn:** (1-2 meningar).
3) Lägg bara till en kort Lgr22-rad (📘) när den tillför värde.

Om användaren ber om facit:
- Ge fullständigt facit.
- Lägg till "Vanliga fel" med 2-3 punkter.
- I matte: per deluppgift (Steg 1: Ställ upp, Steg 2: Räkna, Steg 3: Svar) och använd markdown-kodblock (tre backticks) för uppställning.

Vid bildanalys: identifiera ämne + uppgift, förklara stegvis, avsluta med **Så kan du förklara för ditt barn:**.
`;

const COACH_SYSTEM_INSTRUCTION = `
Du är en pedagogisk coach för en svensk förälder vid köksbordet. Din enda uppgift: ge föräldern frågor att ställa till BARNET — aldrig färdiga svar, förklaringar, uträkningar eller uppställningar.

⚠️ DETTA ÖVERSTYR ALLT ANNAT:
- Om användarens meddelande ber om "Så kan du förklara för ditt barn", "Steg 1/Steg 2/Steg 3", "Tänk så här", "Uträkning", "Svar:", "facit", "uppställning", "Vad vill du göra nu?" eller annat lärar-format: IGNORERA de instruktionerna helt och följ BARA coach-formatet nedan.
- Skriv inga uträkningar, mellanled, siffror eller slutsvar i löptext. Bara frågor och en kort slutrad.
- Skriv inga rubriker som "Uppgift X: ..." med efterföljande förklaring. Är det flera uppgifter — guida bara EN i taget och nämn numret i "🎯 Fråga barnet"-punkten.

Svara ALLTID i EXAKT detta markdown-format — inga andra rubriker, inga extra sektioner:

**🎯 Fråga barnet:**
- 1-2 motfrågor som bygger på något barnet troligen redan kan. Nämn ev. uppgiftsnummer här.

**🪜 Om barnet fastnar:**
- En enklare följdfråga eller konkret liknelse — utan att avslöja svaret.

**✅ När barnet är nära rätt:**
- En sista fråga som leder hem svaret — utan att säga det rakt ut.

**🔁 Förankra:**
- Be barnet förklara tillbaka med egna ord.

**🚫 Undvik:**
- Ett vanligt misstag föräldern lätt gör (t.ex. ge svaret för snabbt).

**Facit (för dig, inte för barnet):** <kort slutsvar på EN enda rad — detta är den ENDA plats där du får visa svaret>

Regler:
- Ton: varm, kort, lekfull men respektfull. Max 1-2 meningar per punkt.
- Använd INTE "Så kan du förklara för ditt barn:" — det hör inte hemma i coach-läget.
- Om uppgiften är öppen (t.ex. skrivuppgift): skriv "Facit (för dig): Inget entydigt rätt svar — bedöm utifrån ..." + 1-2 korta bedömningskriterier.
`;

router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, history, imageBase64, imageBase64s, childGrade, coachMode } = req.body;
    const safeChildGrade = typeof childGrade === 'string' ? childGrade.slice(0, 32) : undefined;
    const isCoach = coachMode === true;

    const images = validateInlineImages(imageBase64, imageBase64s);
    if (images.ok === false) {
      res.status(images.status).json({ error: images.error });
      return;
    }

    const hist = normalizeAndTrimHistory(history);
    if (hist.ok === false) {
      res.status(hist.status).json({ error: hist.error });
      return;
    }

    const p = normalizePrompt(prompt, images.parts.length > 0);
    if (p.ok === false) {
      res.status(p.status).json({ error: p.error });
      return;
    }

    const audienceGuidance = buildAudienceGuidance(safeChildGrade);
    const imageMultiHint = images.parts.length > 0
      ? (isCoach ? MULTI_EXERCISE_IMAGE_INSTRUCTION_COACH : MULTI_EXERCISE_IMAGE_INSTRUCTION)
      : '';
    const effectiveModel = images.parts.length > 0 ? 'gemini-2.5-flash' : TEXT_MODEL;
    const bucket = `${gradeBucket(safeChildGrade)}|${images.parts.length > 0 ? 'image' : 'text'}|${isCoach ? 'coach' : 'teach'}`;
    const baseInstruction = isCoach ? COACH_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION;
    const effectiveSystemInstruction = `${baseInstruction}
${imageMultiHint}

Anpassning för detta barn:
- ${audienceGuidance}
`;
    const cachedContent = await getOrCreatePromptCache(
      effectiveModel,
      bucket,
      effectiveSystemInstruction,
    );
    const cacheKey = images.parts.length > 0
      ? createHash('sha1')
          .update(req.uid || 'anon')
          .update('|')
          .update(p.text)
          .update('|')
          .update(images.parts.map((p2) => p2.inlineData.data.slice(0, 64)).join('|'))
          .digest('hex')
      : null;
    if (cacheKey) {
      const hit = imageAnalysisCache.get(cacheKey);
      if (hit && hit.expiresAtMs > Date.now()) {
        res.json({ text: hit.text, usage: hit.usage, cache: 'hit' });
        return;
      }
    }
    const requestPayload = {
      model: effectiveModel,
      contents: [
        ...hist.history.map((h) => ({
          role: h.role,
          parts: [{ text: h.content }],
        })),
        {
          role: 'user' as const,
          parts: [
            ...images.parts,
            { text: p.text },
          ],
        },
      ],
      config: cachedContent
        ? { cachedContent }
        : { systemInstruction: effectiveSystemInstruction },
    };

    const streamApi = ai.models as unknown as {
      generateContentStream?: (payload: unknown) => Promise<AsyncIterable<{ text?: string; usageMetadata?: unknown }>>;
    };

    if (!streamApi.generateContentStream) {
      const fallback = await ai.models.generateContent(requestPayload);
      const usage = fallback.usageMetadata;
      if (usage) {
        const u = usage as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; cachedContentTokenCount?: number };
        console.log(`[usage] uid=${req.uid} prompt=${u.promptTokenCount} response=${u.candidatesTokenCount} total=${u.totalTokenCount} cached=${u.cachedContentTokenCount ?? 0}`);
      }
      const fallbackText = fallback.text ?? '';
      if (cacheKey) {
        imageAnalysisCache.set(cacheKey, { text: fallbackText, usage, expiresAtMs: Date.now() + IMAGE_ANALYSIS_CACHE_TTL_MS });
      }
      res.json({ text: fallbackText, usage });
      return;
    }

    const stream = await streamApi.generateContentStream(requestPayload);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    let fullText = '';
    let usage: unknown = null;
    for await (const chunk of stream) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata;
      const delta = typeof chunk.text === 'string' ? chunk.text : '';
      if (!delta) continue;
      fullText += delta;
      res.write(`${JSON.stringify({ delta })}\n`);
    }

    if (usage) {
      const u = usage as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; cachedContentTokenCount?: number };
      console.log(`[usage] uid=${req.uid} prompt=${u.promptTokenCount} response=${u.candidatesTokenCount} total=${u.totalTokenCount} cached=${u.cachedContentTokenCount ?? 0}`);
    }
    if (cacheKey) {
      imageAnalysisCache.set(cacheKey, { text: fullText, usage, expiresAtMs: Date.now() + IMAGE_ANALYSIS_CACHE_TTL_MS });
    }
    res.write(`${JSON.stringify({ done: true, text: fullText, usage })}\n`);
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error.message);
    if (res.headersSent) {
      const msg = error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 'RESOURCE_EXHAUSTED'
        ? 'AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund.'
        : 'Ett fel uppstod vid AI-generering.';
      res.write(`${JSON.stringify({ error: msg })}\n`);
      res.end();
    } else if (error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 'RESOURCE_EXHAUSTED') {
      res.status(429).json({ error: 'AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund.' });
    } else {
      res.status(500).json({ error: 'Ett fel uppstod vid AI-generering.' });
    }
  }
});

router.post('/image', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, childGrade } = req.body;
    const np = normalizeImageGenerationPrompt(prompt);
    if (np.ok === false) {
      res.status(np.status).json({ error: np.error });
      return;
    }

    const audienceGuidance = buildAudienceGuidance(childGrade);
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            text: `Skapa en pedagogisk illustration för en svensk skoluppgift. Ämne: ${np.text}. Illustrationen ska vara tydlig, hjälpsam och åldersanpassad. Målgrupp: ${audienceGuidance} För äldre elever: mer neutral, mindre barnslig stil. Undvik text i bilden om möjligt.`,
          },
        ],
      },
      config: {
        responseModalities: ['image', 'text'],
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = `data:image/png;base64,${part.inlineData.data}`;
          res.json({ imageData });
          return;
        }
      }
    }

    res.json({ imageData: null });
  } catch (error: any) {
    console.error('Image generation error:', error.message);
    res.status(500).json({ error: 'Ett fel uppstod vid bildgenerering.' });
  }
});

export { router as aiRouter };
