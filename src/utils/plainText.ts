/**
 * Gör om ett AI-svar till läsbar oformaterad text för delning och urklipp.
 *
 * Den gamla varianten i Chat.tsx ersatte `[`*_>#-]` med mellanslag och slog
 * ihop alla radbrytningar. Det slog sönder både bindestreck mitt i ord
 * ("30-tal" → "30 tal") och minustecken i matten, och gjorde en punktlista
 * till en enda lång mening. Här tas bara markdown-syntaxen bort och styckena
 * behålls, så det som klistras in går att läsa.
 */

/** Runt 3-4 skärmar text. Delningsdialoger på iOS blir svårhanterliga långt över det. */
const MAX_SHARE_CHARS = 4000;

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*\n?/gi, ''))
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    // Punktlistor blir "• " — själva punkten är information, till skillnad från
    // markdown-asterisken. Numrerade listor lämnas som de är.
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s.,;:!?)]|$)/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Klipper vid ett styckes- eller meningsslut i stället för mitt i ett ord, så
 * det som delas alltid slutar begripligt.
 */
export function truncateForShare(text: string, max: number = MAX_SHARE_CHARS): string {
  if (text.length <= max) return text;

  const head = text.slice(0, max);
  const cut = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('. '), head.lastIndexOf('\n'));
  // Ett brott för nära början vore sämre än ett hårt klipp mitt i texten.
  const body = cut > max * 0.6 ? head.slice(0, cut) : head;
  return `${body.trimEnd()}…`;
}
