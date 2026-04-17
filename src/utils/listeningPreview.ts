/**
 * Text för Lyssna: bara början / en kort ingång så TTS inte läser hela svaret
 * (billigare, snabbare, bättre för att komma igång tillsammans).
 */

const DEFAULT_MAX = 880;

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

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const last = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.\n'),
  );
  if (last >= Math.floor(maxLen * 0.35)) {
    return slice.slice(0, last + 1).trim();
  }
  return `${slice.trim()}…`;
}

/**
 * Första delen av AI-svaret: ingress / början, utan långa avslut om de markerats tydligt.
 */
export function listeningPreview(raw: string, maxChars: number = DEFAULT_MAX): string {
  let plain = stripMarkdownForListen(raw);
  plain = cutBeforeOptionalSections(plain);
  plain = plain.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$\n]{1,120}\$/g, ' ');
  plain = plain.trim();
  if (!plain) return '';

  const paragraphs = plain.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return '';

  let out = '';
  for (const p of paragraphs) {
    const next = out ? `${out}\n\n${p}` : p;
    if (next.length > maxChars) {
      if (!out) return truncateAtSentence(p, maxChars);
      return truncateAtSentence(out, maxChars);
    }
    out = next;
  }
  return truncateAtSentence(out, maxChars);
}
