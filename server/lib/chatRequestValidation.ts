/**
 * Server-side limits aligned with Firestore (messages: content &lt; 10000)
 * so API requests cannot exceed what legitimate clients could persist.
 */

export const MAX_CHAT_CONTENT_CHARS = 49999;
export const MAX_HISTORY_TOKEN_BUDGET = 4000;
export const MAX_INLINE_IMAGES = 5;
/** Approximate decoded image size per image (base64 payload). */
export const MAX_IMAGE_DECODED_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ChatRole = 'user' | 'model';

export interface ChatHistoryItem {
  role: ChatRole;
  content: string;
}

export interface InlineImagePart {
  inlineData: { mimeType: string; data: string };
}

export type ValidateFail = { ok: false; status: number; error: string };

function approxDecodedBase64Bytes(b64: string): number {
  const stripped = b64.replace(/\s/g, '');
  if (stripped.length === 0) return 0;
  let padding = 0;
  if (stripped.endsWith('==')) padding = 2;
  else if (stripped.endsWith('=')) padding = 1;
  return Math.floor((stripped.length * 3) / 4) - padding;
}

function normalizeMime(raw: string): string {
  const base = raw.split(';')[0].trim().toLowerCase();
  return base;
}

/**
 * Parse data URL or raw base64; validate mime and size.
 */
export function parseOneImage(img: string): InlineImagePart | ValidateFail {
  let mimeType = 'image/jpeg';
  let cleanBase64 = img;
  if (img.startsWith('data:')) {
    const match = img.match(/^data:([^;]+);base64,(.+)$/is);
    if (!match) {
      return { ok: false, status: 400, error: 'Ogiltigt bildformat (data-URL).' };
    }
    mimeType = normalizeMime(match[1]);
    cleanBase64 = match[2];
  }
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return { ok: false, status: 400, error: 'Bildtypen stöds inte. Använd JPEG, PNG eller WebP.' };
  }
  const bytes = approxDecodedBase64Bytes(cleanBase64);
  if (bytes > MAX_IMAGE_DECODED_BYTES) {
    return { ok: false, status: 413, error: 'Bilden är för stor.' };
  }
  if (bytes === 0) {
    return { ok: false, status: 400, error: 'Ogiltig bilddata.' };
  }
  return { inlineData: { mimeType, data: cleanBase64 } };
}

export function collectImageInputs(imageBase64: unknown, imageBase64s: unknown): string[] {
  if (Array.isArray(imageBase64s)) {
    return imageBase64s.filter((img): img is string => typeof img === 'string' && img.length > 0);
  }
  if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
    return [imageBase64];
  }
  return [];
}

export function validateInlineImages(imageBase64: unknown, imageBase64s: unknown):
  | { ok: true; parts: InlineImagePart[] }
  | ValidateFail {
  const raw = collectImageInputs(imageBase64, imageBase64s);
  if (raw.length > MAX_INLINE_IMAGES) {
    return { ok: false, status: 400, error: `Högst ${MAX_INLINE_IMAGES} bilder per förfrågan.` };
  }
  const parts: InlineImagePart[] = [];
  for (const img of raw) {
    const parsed = parseOneImage(img);
    if ('ok' in parsed) {
      return parsed;
    }
    parts.push(parsed);
  }
  return { ok: true, parts };
}

export function normalizeAndTrimHistory(raw: unknown):
  | { ok: true; history: ChatHistoryItem[] }
  | ValidateFail {
  if (raw == null) {
    return { ok: true, history: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Ogiltig chatt-historik.' };
  }
  const out: ChatHistoryItem[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') {
      return { ok: false, status: 400, error: 'Ogiltigt meddelande i historiken.' };
    }
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== 'user' && role !== 'model') {
      return { ok: false, status: 400, error: 'Ogiltig roll i chatt-historiken.' };
    }
    if (typeof content !== 'string') {
      return { ok: false, status: 400, error: 'Ogiltigt meddelande i historiken.' };
    }
    const trimmed = content.slice(0, MAX_CHAT_CONTENT_CHARS);
    if (trimmed.length > 0) {
      out.push({ role, content: trimmed });
    }
  }
  const budgeted: ChatHistoryItem[] = [];
  let usedTokens = 0;
  // Keep latest messages; trim oldest first.
  for (let i = out.length - 1; i >= 0; i--) {
    const msg = out[i]!;
    const approxTokens = Math.max(1, Math.ceil(msg.content.length / 4));
    if (usedTokens + approxTokens > MAX_HISTORY_TOKEN_BUDGET) continue;
    usedTokens += approxTokens;
    budgeted.push(msg);
  }
  budgeted.reverse();
  return { ok: true, history: budgeted };
}

export function normalizePrompt(prompt: unknown, hasImages: boolean):
  | { ok: true; text: string }
  | ValidateFail {
  if (hasImages && (prompt == null || (typeof prompt === 'string' && !prompt.trim()))) {
    return { ok: true, text: 'Analysera denna bild.' };
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, status: 400, error: 'Meddelande eller bild krävs.' };
  }
  return { ok: true, text: prompt.slice(0, MAX_CHAT_CONTENT_CHARS) };
}

export const MAX_IMAGE_GEN_PROMPT_CHARS = 2000;

export function normalizeImageGenerationPrompt(prompt: unknown):
  | { ok: true; text: string }
  | ValidateFail {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, status: 400, error: 'Beskrivning krävs för bildgenerering.' };
  }
  return { ok: true, text: prompt.slice(0, MAX_IMAGE_GEN_PROMPT_CHARS) };
}
