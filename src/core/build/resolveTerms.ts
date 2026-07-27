import type { ExportTermRef, TermMapping, TermRef, TermTable } from '../../types/domain';
import { termMappingIdOf } from '../mappings/termId';

/** Resolves an article's old-site terms into new-site terms for export,
 * via the mapping table. A term with no mapping, or one whose target
 * table/term no longer exists, is dropped rather than guessed — it never
 * blocks the article, it just carries no taxonomy for that term. */
export function resolveArticleTerms(
  terms: TermRef[],
  mappings: Record<string, TermMapping>,
  newTables: TermTable[],
): ExportTermRef[] {
  const tableById = new Map(newTables.map((table) => [table.id, table]));
  const out: ExportTermRef[] = [];

  for (const term of terms) {
    const mapping = mappings[termMappingIdOf(term)];
    if (!mapping || !mapping.targetTableId || !mapping.targetTermId) continue;

    const table = tableById.get(mapping.targetTableId);
    const newTerm = table?.terms.find((candidate) => candidate.id === mapping.targetTermId);
    if (!table || !newTerm) continue;

    out.push({ domain: table.id, nicename: newTerm.slug || newTerm.id, name: newTerm.name });
  }

  return out;
}
