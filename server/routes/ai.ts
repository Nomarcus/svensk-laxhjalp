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

/**
 * Modellval. Vill du flytta ALLA textvägar på en gång räcker en variabel:
 *
 *   AI_MODEL=gemini-3.1-flash-lite
 *
 * De enskilda variablerna nedan vinner över AI_MODEL, för den som vill finjustera
 * en väg (t.ex. dyrare modell bara för facit). Utan någon variabel körs standardvalen.
 *
 * Bildmodellen styrs separat av AI_IMAGE_MODEL — den är en annan sorts modell.
 */
const SHARED_MODEL = process.env.AI_MODEL?.trim() || '';
const TEXT_MODEL = process.env.AI_TEXT_MODEL || SHARED_MODEL || 'gemini-2.5-flash-lite';
/**
 * gemini-2.5-flash-image stängs av i Gemini API den 2 oktober 2026 — efter det slutar
 * illustrationerna fungera helt. gemini-3.1-flash-lite-image är Googles efterträdare
 * och dessutom billigare per bild.
 */
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';
/** Foton av läxor. Separat väg så att den syns när den byts — den är oftast den dyraste. */
const IMAGE_ANALYSIS_MODEL = process.env.AI_IMAGE_ANALYSIS_MODEL || SHARED_MODEL || 'gemini-2.5-flash';
/** Facit och rättning — svaret används som facit, så det ska inte köras på den billigaste modellen. */
const PRECISION_MODEL = process.env.AI_PRECISION_MODEL || SHARED_MODEL || 'gemini-2.5-flash';

/**
 * Reservmodeller. 2.5 är billigast och fungerar, men Google har aviserat avstängning
 * (Google Cloud: 16 okt för 2.5 Flash, 20 okt för 2.5 Flash-Lite; Gemini API har inget
 * datum ännu). I stället för att någon ska hinna byta i tid byter servern själv:
 * svarar Google att modellen inte finns, körs samma fråga om på reservmodellen.
 * Föräldern märker ingenting, och loggen får en rad "[models] FALLBACK".
 */
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL?.trim() || 'gemini-3.1-flash-lite';
/** Reserv för bilder om det nya ID:t inte skulle stämma. Fungerar bara till 2 okt. */
const IMAGE_FALLBACK_MODEL = process.env.AI_IMAGE_FALLBACK_MODEL?.trim() || 'gemini-2.5-flash-image';

/** Modeller som nyss svarat "finns inte". Hoppas över en timme så att varje fråga inte först ska misslyckas. */
const unavailableUntil = new Map<string, number>();
const UNAVAILABLE_TTL_MS = 60 * 60 * 1000;

function markUnavailable(model: string): void {
  unavailableUntil.set(model, Date.now() + UNAVAILABLE_TTL_MS);
}

function isKnownUnavailable(model: string): boolean {
  const until = unavailableUntil.get(model);
  if (!until) return false;
  if (until > Date.now()) return true;
  unavailableUntil.delete(model);
  return false;
}

/**
 * Bara fel som betyder att själva modellen saknas eller är avstängd. Överbelastning
 * (429) och serverfel (5xx) ska INTE byta modell — de går över av sig själva, och ett
 * byte där skulle dölja ett annat problem.
 */
function isModelUnavailable(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  if (status === 404) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /NOT_FOUND|models\/[\w.-]+ is not found|is not supported for|no longer (?:available|supported)|has been (?:deprecated|retired|shut ?down)/i.test(message);
}

/**
 * Kör ett anrop mot primärmodellen och, om den inte finns, samma anrop mot reserven.
 * `call` får modellen och en flagga om det är reserven (då får anroparen t.ex. inte
 * använda en promptcache, eftersom cachen är knuten till primärmodellen).
 */
async function withModelFallback<T>(
  primary: string,
  fallback: string,
  call: (model: string, isFallback: boolean) => Promise<T>,
): Promise<T> {
  if (primary !== fallback && isKnownUnavailable(primary)) {
    return call(fallback, true);
  }
  try {
    return await call(primary, false);
  } catch (error) {
    if (primary === fallback || !isModelUnavailable(error)) throw error;
    markUnavailable(primary);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[models] FALLBACK ${primary} -> ${fallback}: ${message.slice(0, 160)}`);
    return call(fallback, true);
  }
}

/**
 * Kontrollerar vid uppstart att varje konfigurerad modell faktiskt finns. Ett felstavat
 * eller avstängt modell-ID märks annars först när en förälder får ett felmeddelande.
 * Kontrollen är gratis, blockerar aldrig uppstarten och kraschar aldrig servern.
 * Resultatet står i Cloud Run-loggen: sök på "[models]".
 */
async function verifyConfiguredModels(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;
  const wanted: Record<string, string[]> = {};
  for (const [role, id] of Object.entries({
    text: TEXT_MODEL,
    'foto-analys': IMAGE_ANALYSIS_MODEL,
    facit: PRECISION_MODEL,
    illustration: IMAGE_MODEL,
    'reserv text': FALLBACK_MODEL,
    'reserv bild': IMAGE_FALLBACK_MODEL,
  })) {
    (wanted[id] ||= []).push(role);
  }
  await Promise.all(
    Object.entries(wanted).map(async ([id, roles]) => {
      try {
        await ai.models.get({ model: id });
        console.info(`[models] OK      ${id} (${roles.join(', ')})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isModelUnavailable(error)) markUnavailable(id);
        console.error(`[models] SAKNAS  ${id} (${roles.join(', ')}): ${message.slice(0, 160)}`);
      }
    }),
  );
}
void verifyConfiguredModels();
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

/**
 * Bildstil per årskurs. Bildmodellen fick tidigare samma riktlinjer som chattsvaren
 * ("Så säger du till barnet", notation), som inte säger något om hur en bild ska se ut,
 * och bilderna blev ofta barnsliga även för högstadiet.
 */
function buildImageStyle(rawGrade?: unknown): string {
  const grade = parseGradeLevel(rawGrade);
  if (grade === null) {
    return 'Neutral, saklig stil som passar både mellanstadie- och högstadieelever: ren vektorillustration, dämpade färger, inga seriefigurer.';
  }
  if (grade <= 3) {
    return `Elev i årskurs ${grade}. Vänlig, färgglad men lugn illustration med enkla, tydliga former och vardagliga föremål (frukt, leksaker, djur) att räkna eller jämföra. Inga skämt eller överdrivna ansikten.`;
  }
  if (grade <= 6) {
    return `Elev i årskurs ${grade}. Tydlig skolboksillustration: rena former, få färger, konkreta modeller (tallinje, cirkeldiagram, rutnät, karta). Inte gullig, inga seriefigurer med ansikten.`;
  }
  if (grade <= 9) {
    return `Elev i årskurs ${grade}. Saklig och vuxen stil som i en läromedelsbok för högstadiet: diagram, schematisk figur eller realistisk skiss. Inga tecknade figurer, maskotar eller barnsliga element.`;
  }
  return 'Gymnasieelev. Stram, teknisk illustration som i en lärobok: diagram, graf eller schematisk modell. Helt utan barnsliga element.';
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

ORDNING. Appen visar varje rubrik nedan som en egen ruta, i exakt den här ordningen.
Allt som står efter **Så säger du till barnet:** visas som en del av barnförklaringen,
så den rubriken ska alltid komma sist.

1) **Kort om uppgiften:** — 2-4 korta rader som gör att föräldern direkt fattar läget:
   - Vad uppgiften går ut på, med uppgiftens egna tal, ord och enheter.
   - Hur man löser den: metoden, konkret och i rätt ordning.
   - Slutsvaret, om uppgiften har ett entydigt sådant.
   Den här rutan läses ensam, före allt annat, av en stressad förälder vid köksbordet.
   Skriv därför INGA liknelser, inga "tänk dig att...", ingen uppmuntran och inga
   uppvärmningsmeningar här — bara vad det handlar om och vad man gör.
2) **Till dig som vuxen:** — gå igenom uppgiften steg för steg. Det är FORTSÄTTNINGEN på
   "Kort om uppgiften", aldrig en omskrivning av den. Avsluta den här delen med:
   - **Nästa bästa steg:** 2-3 konkreta punkter. Här hör förslag på planering hemma.
   - Bara om det tillför något: en enda rad som börjar med 📘 och med egna ord säger
     vilket centralt innehåll i Lgr22 uppgiften tränar.
3) **Så säger du till barnet:** — SIST i svaret. 1-3 meningar som föräldern kan säga
   högt, med enkla ord. Det är här, och bara här, en liknelse hör hemma.
   Skriv ingenting efter den — inga fler rubriker, frågor eller avslutningar.

LÄNGD. Hela svaret ska vara högst cirka 250 ord, om inte föräldern uttryckligen ber om
facit, fördjupning eller koppling till läroplanen. Säg varje sak en gång. Upprepa inte
samma information under flera rubriker.

SKRIV ALDRIG:
- En avslutande del som "Vad vill du göra nu?" eller frågor om vad föräldern vill göra
  härnäst. Appen har egna knappar för nästa uppgift, fördjupning och facit. Det gäller
  även när meddelandet du får ber om en sådan del.
- Text före **Kort om uppgiften:**, utom rubriken **Uppgiften:** vid bildanalys.

LÄROPLANEN (Lgr22):
- Citera aldrig läroplanen ordagrant och skriv aldrig formuleringar som ser ut som citat
  ur den. Beskriv med egna ord.
- Använd Lgr22:s begrepp "centralt innehåll" och "betygskriterier". Ordet "kunskapskrav"
  gällde före 2022; använd det inte. Frågar föräldern om kunskapskrav, förklara kort att
  de numera heter betygskriterier.
- Hitta aldrig på kriterier eller nivåer. Är du osäker på exakt vad som gäller för en
  årskurs, beskriv bara det centrala innehållet.

Om användaren ber om facit:
- Ge fullständigt facit.
- Lägg till "Vanliga fel" med 2-3 punkter.
- I matte: per deluppgift (Steg 1: Ställ upp, Steg 2: Räkna, Steg 3: Svar) och använd markdown-kodblock (tre backticks) för uppställning.

Innan du svarar — alltid:
- Räkna igenom matten baklänges och kontrollera att svaret stämmer och att enheterna är rimliga. Hittar du ett fel, rätta det innan du skriver svaret.
- Använd bara metoder barnet rimligen har lärt sig i sin årskurs. Behöver du ta en genväg: nämn den kort och visa skolans metod också.

Vid bildanalys:
- Börja med rubriken **Uppgiften:** och skriv av uppgiften exakt som den står — siffror, tecken, enheter. Först därefter kommer **Kort om uppgiften:** och resten i ordningen ovan.
- Är något suddigt, avklippt eller omöjligt att tyda: skriv [oläsligt] på den platsen och säg vad föräldern behöver fota om. Gissa aldrig på en siffra.
- Finns det ingen läxa eller skoluppgift på bilden: svara bara med **Kort om uppgiften:** och 1-2 meningar om vad bilden visar och att föräldern behöver fota själva läxan. Inga andra rubriker.

Om uppgiften är omöjlig att förstå, eller om det saknas information du behöver (en sida som inte syns, en instruktion som inte är med): säg det rakt ut i stället för att gissa. Det är ett fullgott svar.
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

    const stream = await withModelFallback(effectiveModel, FALLBACK_MODEL, (model, isFallback) =>
      ai.models.generateContentStream(
        isFallback
          ? {
              ...requestPayload,
              model,
              // Promptcachen hör till primärmodellen och går inte att använda här.
              config: {
                maxOutputTokens: requestPayload.config.maxOutputTokens,
                temperature: requestPayload.config.temperature,
                systemInstruction: effectiveSystemInstruction,
              },
            }
          : requestPayload,
      ),
    );
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

    const style = buildImageStyle(childGrade);
    const response = await withModelFallback(IMAGE_MODEL, IMAGE_FALLBACK_MODEL, (model) => ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            text: [
              'Skapa EN pedagogisk illustration som hjälper en elev att förstå idén i skoluppgiften nedan.',
              `Stil och målgrupp: ${style}`,
              'Visa begreppet konkret (till exempel bitar av en helhet för bråk, föremål i grupper för multiplikation, en enkel karta eller ett förlopp). En tydlig huvudidé, enkel bakgrund.',
              'Matematiken i bilden måste stämma exakt med uppgiften. Visa hellre färre siffror än fel siffror.',
              'Ingen löptext i bilden. Siffror eller enstaka ord bara om de behövs, och då på svenska och korrekt stavade.',
              'Visa inte svaret om uppgiften går ut på att eleven ska räkna fram det.',
              '',
              `Uppgiften och förklaringen:\n${np.text}`,
            ].join('\n'),
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
    }));

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const mime = part.inlineData.mimeType || 'image/png';
          const imageData = `data:${mime};base64,${part.inlineData.data}`;
          res.json({ imageData });
          return;
        }
      }
    }

    // Modellen svarade med bara text. Säg det, i stället för att knappen tyst slutar snurra.
    console.error('Image generation error: inget bildsvar', response.candidates?.[0]?.finishReason);
    res.status(502).json({ error: 'Ingen bild skapades. Försök igen.' });
  } catch (error: any) {
    console.error('Image generation error:', error.message);
    res.status(500).json({ error: 'Ett fel uppstod vid bildgenerering.' });
  }
});

export { router as aiRouter };
