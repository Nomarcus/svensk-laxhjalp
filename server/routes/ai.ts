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
/** Model used when a chat message includes photos to analyze — separate from TEXT_MODEL
 * so changing AI_TEXT_MODEL doesn't silently leave the (usually pricier) image path untouched. */
const IMAGE_ANALYSIS_MODEL = process.env.AI_IMAGE_ANALYSIS_MODEL || 'gemini-2.5-flash';
/** Facit och rättning — svaret används som facit, så det ska inte köras på den billigaste modellen. */
const PRECISION_MODEL = process.env.AI_PRECISION_MODEL || 'gemini-2.5-flash';
/** Temperatur per läge. Standard är 1.0, vilket är för slumpmässigt för ett facit. */
const TEMPERATURE_DEFAULT = Number(process.env.AI_TEMPERATURE) || 0.35;
const TEMPERATURE_PRECISION = Number(process.env.AI_TEMPERATURE_PRECISION) || 0.15;

const SIMPLE_SWEDISH_DIRECTIVE = `
LÄTTLÄST SVENSKA — detta överstyr formuleringarna ovan (men inte rubrikerna):
- Max 8 ord per mening. En tanke per mening. Inga bisatser.
- Bara vanliga, vardagliga ord. Måste du använda ett skolord: skriv det enkla ordet först och skolordet i parentes.
- Använd punktlistor i stället för stycken.
`;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
};

/** Svaret skrevs alltid på svenska eftersom språkvalet aldrig lästes av servern. */
function languageDirective(raw?: unknown): string {
  if (typeof raw !== 'string') return '';
  const name = LANGUAGE_NAMES[raw.trim().toLowerCase()];
  if (!name) return '';
  return `
SPRÅK: Föräldern använder appen på ${name}. Skriv hela svaret på ${name}.
Behåll svenska skoltermer (ämnesnamn, "Lgr22", "årskurs") på svenska, och behåll rubrikerna exakt som de står ovan på svenska så appen kan läsa dem.
`;
}
const PROMPT_CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000;
/** Hard ceiling on response length — protects against runaway/looping generations. */
const MAX_OUTPUT_TOKENS_CHAT = Number(process.env.AI_MAX_OUTPUT_TOKENS) || 4096;
/** Generous on purpose: image-gen output includes the image itself, and a too-low cap risks truncating it. */
const MAX_OUTPUT_TOKENS_IMAGE_GEN = 8192;

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

/**
 * Årskursen är den enskilt viktigaste kvalitetsfaktorn i ett svar. Tidigare styrde
 * den bara tonfallet; nu styr den också läsnivån i texten föräldern läser högt,
 * vilken notation som får användas och vilka metoder barnet faktiskt kan ha lärt sig.
 */
function buildAudienceGuidance(rawGrade?: unknown): string {
  const grade = parseGradeLevel(rawGrade);
  if (grade === null) {
    return [
      'Årskurs okänd. Håll en neutral nivå: tydligt men inte barnsligt språk.',
      'Under **Så säger du till barnet:** — max 3 korta meningar, vardagliga ord.',
      'Undvik avancerad notation tills du vet nivån.',
    ].join('\n- ');
  }
  if (grade <= 3) {
    return [
      'Lågstadium (åk 1-3). Varm och lekfull ton, mycket konkreta exempel ur vardagen.',
      'Under **Så säger du till barnet:** — max 2 meningar, högst 8 ord per mening, inga bisatser.',
      'Notation: bara +, -, enkel × och enklaste bråk. Använd inte ÷, x som obekant eller decimaltal med många siffror.',
      'Metoder: räkna på fingrar, talraden, hoppa i tiotal, rita. Aldrig algebra eller uppställning med minnessiffra om uppgiften inte redan visar den.',
    ].join('\n- ');
  }
  if (grade <= 6) {
    return [
      'Mellanstadium (åk 4-6). Tydlig och coachande ton, konkreta exempel, mindre lekfullt.',
      'Under **Så säger du till barnet:** — max 3 meningar, högst 12 ord per mening.',
      'Notation: de fyra räknesätten, bråk, decimaltal, procent, enkel geometri. Inte ekvationer med x om uppgiften inte redan gör det.',
      'Metoder: skolans uppställning, liggande stolen, sambandet mellan bråk-decimal-procent. Lös inte med algebra det som ska lösas med uppställning.',
    ].join('\n- ');
  }
  if (grade <= 9) {
    return [
      'Högstadium (åk 7-9). Mogen, rak och respektfull ton, ämneskorrekt terminologi.',
      'Under **Så säger du till barnet:** — max 3 meningar, tala med barnet som en ung person, inte som ett litet barn.',
      'Notation: ekvationer, potenser, Pythagoras sats, funktioner, negativa tal.',
      'Metoder: algebraisk lösning är i regel rätt nivå. Visa gärna kontrollräkningen.',
    ].join('\n- ');
  }
  return [
    'Gymnasienivå. Vuxen ton, precision och struktur, undvik barnsliga metaforer.',
    'Under **Så säger du till barnet:** — tala till en ungdom; förklara resonemanget, inte bara svaret.',
    'Notation och metoder: full gymnasienivå, inklusive formell algebra och funktionsanalys.',
  ].join('\n- ');
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
  if (hit && hit.expiresAtMs > now) {
    console.log(`[cache] hit bucket=${bucket} model=${model}`);
    return hit.cachedContentName;
  }

  try {
    const cache = await ai.caches.create({
      model,
      config: {
        systemInstruction,
        ttl: '3600s',
      },
    });
    const name = cache.name;
    if (!name) {
      console.warn(`[cache] Gemini returned no cache name bucket=${bucket} model=${model}`);
      return null;
    }
    console.log(`[cache] created bucket=${bucket} model=${model} tokens=${cache.usageMetadata?.totalTokenCount ?? 'unknown'}`);
    promptCacheByBucket.set(key, { cachedContentName: name, expiresAtMs: now + PROMPT_CACHE_TTL_MS });
    return name;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[cache] create failed bucket=${bucket} model=${model}: ${message}`);
    return null;
  }
}

const SYSTEM_INSTRUCTION = `
Du hjälper svenska föräldrar med barnens läxor. Skriv på svenska, kort och konkret.
Målgrupp: förälder (inte elev), med praktiska råd för hemmet.

Krav i varje svar:
1) Förklara uppgiften steg för steg.
2) Använd alltid två tydliga rubriker: **Till dig som vuxen:** och **Så säger du till barnet:**. Under vuxen-rubriken förklarar du kort vad uppgiften handlar om. Under barn-rubriken skriver du exakt hur föräldern kan säga det med enkla ord.
3) Avsluta med **Nästa bästa steg:** med 2-3 konkreta punkter.
4) Lägg bara till en kort Lgr22-rad (📘) när den tillför värde.

Om användaren ber om facit:
- Ge fullständigt facit.
- Lägg till "Vanliga fel" med 2-3 punkter.
- I matte: per deluppgift (Steg 1: Ställ upp, Steg 2: Räkna, Steg 3: Svar) och använd markdown-kodblock (tre backticks) för uppställning.

Innan du svarar — alltid:
- Räkna igenom matten baklänges och kontrollera att svaret stämmer och att enheterna är rimliga. Hittar du ett fel, rätta det innan du skriver svaret.
- Använd bara metoder barnet rimligen har lärt sig i sin årskurs. Behöver du ta en genväg: nämn den kort och visa skolans metod också.

Vid bildanalys:
- Skriv först av uppgiften exakt som den står — siffror, tecken, enheter — under rubriken **Så här läser jag uppgiften:**. Först därefter löser du den.
- Är något suddigt, avklippt eller omöjligt att tyda: skriv [oläsligt] på den platsen och säg vad föräldern behöver fota om. Gissa aldrig på en siffra.
- Identifiera sedan ämne + uppgift, förklara stegvis och använd rubrikerna **Till dig som vuxen:**, **Så säger du till barnet:** och **Nästa bästa steg:**.

Om uppgiften är omöjlig att förstå, eller om det saknas information du behöver (en sida som inte syns, en instruktion som inte är med): säg det rakt ut i stället för att gissa. Det är ett fullgott svar.
När svaret handlar om läxa, prov, inlämning eller övning: föreslå kort en relevant planering, t.ex. lägg som läxa, öva 10 minuter per dag eller skapa checklista inför provet.
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
    const { prompt, history, imageBase64, imageBase64s, childGrade, coachMode, simpleSwedish, language, precision } = req.body;
    const safeChildGrade = typeof childGrade === 'string' ? childGrade.slice(0, 32) : undefined;
    const isCoach = coachMode === true;
    const isSimple = simpleSwedish === true;
    // Facit och rättning: svaret visas för barnet som facit, så slumpen ska vara låg
    // och modellen starkare än den billiga standardmodellen.
    const isPrecision = precision === true;

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
    const effectiveModel = isPrecision
      ? PRECISION_MODEL
      : images.parts.length > 0
        ? IMAGE_ANALYSIS_MODEL
        : TEXT_MODEL;
    const bucket = [
      gradeBucket(safeChildGrade),
      images.parts.length > 0 ? 'image' : 'text',
      isCoach ? 'coach' : 'teach',
      isSimple ? 'simple' : 'normal',
      languageDirective(language) ? `lang:${String(language).slice(0, 5)}` : 'sv',
    ].join('|');
    const baseInstruction = isCoach ? COACH_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION;
    const effectiveSystemInstruction = `${baseInstruction}
${imageMultiHint}
${isSimple ? SIMPLE_SWEDISH_DIRECTIVE : ''}
${languageDirective(language)}

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
          // Hela bilddatan måste med. Med bara de första tecknen blev nyckeln
          // JPEG-huvudet, som är identiskt för varje bild appen producerar —
          // två olika läxfoton med samma snabbknapp fick då samma nyckel och
          // föräldern serverades förra bildens svar.
          .update(images.parts.map((p2) => p2.inlineData.data).join('|'))
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
      config: {
        maxOutputTokens: MAX_OUTPUT_TOKENS_CHAT,
        temperature: isPrecision ? TEMPERATURE_PRECISION : TEMPERATURE_DEFAULT,
        ...(cachedContent
          ? { cachedContent }
          : { systemInstruction: effectiveSystemInstruction }),
      },
    };

    const stream = await ai.models.generateContentStream(requestPayload);
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
        maxOutputTokens: MAX_OUTPUT_TOKENS_IMAGE_GEN,
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
