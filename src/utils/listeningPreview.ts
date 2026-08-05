/**
 * Text för Lyssna: städa AI-svaret till uppläsningsbar text.
 * Uppläsningen ska läsa hela svaret och inte bara en kort förhandsvisning.
 */

export const PREMIUM_TTS_SAFE_CHAR_LIMIT = 4500;

/** Samma städning som tidigare i useSpeech (utan server-import). */
export function stripMarkdownForListen(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/>\s+/g, '')
    .replace(/---+/g, '')
    .replace(/📘.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Klipp bort avslutande val om de redan finns i texten (så TTS inte läser knapptexter). */
function cutBeforeOptionalSections(plain: string): string {
  let t = plain;
  const stop = t.search(/\*{0,2}Vad vill du göra nu\?\*{0,2}/i);
  if (stop >= 80) t = t.slice(0, stop).trim();
  const vf = t.search(/\*{0,2}Vanliga fel\*{0,2}/i);
  if (vf >= 80) t = t.slice(0, vf).trim();
  const h = t.search(/\n##\s*Vanliga fel/im);
  if (h >= 80) t = t.slice(0, h).trim();
  return t.trim();
}

/**
 * Hela AI-svaret, utan avslutande knappval/sektioner som inte bör läsas upp.
 */
export function listeningText(raw: string): string {
  let plain = stripMarkdownForListen(raw);
  plain = cutBeforeOptionalSections(plain);
  plain = plain.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$\n]{1,120}\$/g, ' ');
  return plain.trim();
}

/**
 * Bakåtkompatibelt namn för äldre anrop: returnerar numera hela texten.
 */
export function listeningPreview(raw: string): string {
  return listeningText(raw);
}
