/** Below this Sørensen–Dice score, suggestTerms leaves a term unmapped
 * rather than guessing. Exported so it can be tuned in one place once
 * real migrations show how it behaves (see design spec §5.8/§8). */
export const SUGGESTION_THRESHOLD = 0.55;

/** Lowercases, strips diacritics and punctuation, collapses whitespace,
 * and naively singularises a trailing "s" — enough to make "Case
 * Studies" and "case-study" compare as near-identical without a full
 * stemmer. */
export function normalizeTermName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/s$/, '');
}

function bigrams(text: string): string[] {
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 2) return compact ? [compact] : [];
  const grams: string[] = [];
  for (let i = 0; i < compact.length - 1; i += 1) {
    grams.push(compact.slice(i, i + 2));
  }
  return grams;
}

/** Sørensen–Dice coefficient over character bigrams: 2 * |shared
 * bigrams| / (|bigrams(a)| + |bigrams(b)|), 0..1. Implemented in-house
 * (rather than pulling in the unmaintained `string-similarity` package)
 * so core/ stays dependency-free. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const gram of bigramsA) counts.set(gram, (counts.get(gram) ?? 0) + 1);

  let matches = 0;
  for (const gram of bigramsB) {
    const remaining = counts.get(gram) ?? 0;
    if (remaining > 0) {
      matches += 1;
      counts.set(gram, remaining - 1);
    }
  }

  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

/** The score suggestTerms actually compares against the threshold: dice
 * coefficient over the normalized forms of two term names. */
export function similarityScore(a: string, b: string): number {
  return diceCoefficient(normalizeTermName(a), normalizeTermName(b));
}
