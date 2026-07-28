import type { TermMapping, TermRef, TermTable } from '../../types/domain';
import { SUGGESTION_THRESHOLD, similarityScore } from './similarity';
import { termMappingIdOf } from './termId';

interface BestMatch {
  tableId: string;
  termId: string;
  score: number;
}

function findBestMatch(termName: string, newTables: TermTable[]): BestMatch | null {
  let best: BestMatch | null = null;
  for (const table of newTables) {
    for (const candidate of table.terms) {
      const score = similarityScore(termName, candidate.name);
      if (!best || score > best.score) {
        best = { tableId: table.id, termId: candidate.id, score };
      }
    }
  }
  return best;
}

/** Purely generic name similarity — no per-site mapping table, so the
 * same code serves any migration (design spec §5.8). Compares each old
 * term's name against every term across every new-site table; a
 * suggestion's target table follows wherever the best match came from
 * (matching a category suggests a category mapping, matching a tag
 * suggests a tag). Total and side-effect-free: an empty or malformed
 * newTables list simply yields no suggestions rather than an error. */
export function suggestTerms(oldTerms: TermRef[], newTables: TermTable[]): Record<string, TermMapping> {
  const suggestions: Record<string, TermMapping> = {};

  for (const term of oldTerms) {
    const best = findBestMatch(term.name, newTables);
    if (!best || best.score < SUGGESTION_THRESHOLD) continue;

    suggestions[termMappingIdOf(term)] = {
      oldDomain: term.domain,
      oldNicename: term.nicename,
      targetTableId: best.tableId,
      targetTermIds: [best.termId],
      excluded: false,
      origin: 'suggested',
      score: best.score,
    };
  }

  return suggestions;
}

/** Same matching pass as suggestTerms, but total: every old term appears
 * in the result. A term whose best match clears SUGGESTION_THRESHOLD is
 * mapped exactly as suggestTerms would map it; anything that doesn't is
 * explicitly excluded (excluded: true, no destination) instead of being
 * left out of the result entirely - the caller (the Mappings tab's
 * "Auto-match all" action) wants a decision for every term, not a
 * mix of decided-and-silent. */
export function matchAllTerms(oldTerms: TermRef[], newTables: TermTable[]): Record<string, TermMapping> {
  const result: Record<string, TermMapping> = {};

  for (const term of oldTerms) {
    const best = findBestMatch(term.name, newTables);
    const matched = best && best.score >= SUGGESTION_THRESHOLD;

    const mapping: TermMapping = {
      oldDomain: term.domain,
      oldNicename: term.nicename,
      targetTableId: matched ? best.tableId : null,
      targetTermIds: matched ? [best.termId] : [],
      excluded: !matched,
      origin: 'suggested',
    };

    if (matched) {
      mapping.score = best.score;
    }

    result[termMappingIdOf(term)] = mapping;
  }

  return result;
}
