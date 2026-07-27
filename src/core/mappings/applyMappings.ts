import type { TermMapping, TermRef, TermTable } from '../../types/domain';
import { suggestTerms } from './suggestTerms';
import { termMappingIdOf } from './termId';

/** Recomputes suggestions against the current new-site tables and merges
 * them into `existingMappings`, honouring the one rule that keeps
 * suggestions from fighting the user (design spec §5.8): a mapping the
 * user has touched (`origin: 'user'`) is never overwritten or removed by
 * recomputation, no matter what the new similarity pass finds. Every
 * other old term is replaced with whatever the fresh suggestion pass
 * produces — including being removed entirely if nothing scores above
 * the threshold anymore. */
export function applyMappings(
  oldTerms: TermRef[],
  newTables: TermTable[],
  existingMappings: Record<string, TermMapping>,
): Record<string, TermMapping> {
  const suggestions = suggestTerms(oldTerms, newTables);
  const result: Record<string, TermMapping> = { ...existingMappings };

  for (const term of oldTerms) {
    const id = termMappingIdOf(term);
    const existing = result[id];
    if (existing && existing.origin === 'user') continue;

    const suggestion = suggestions[id];
    if (suggestion) {
      result[id] = suggestion;
    } else {
      delete result[id];
    }
  }

  return result;
}
