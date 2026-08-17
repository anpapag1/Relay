import type { ExportTermRef, TermMapping, TermRef, TermTable } from '../../types/domain';
import { termMappingIdOf } from '../mappings/termId';

/** The taxonomy the mapped term actually came from: the source term's
 * old-site domain (e.g. `category`, `post_tag`), falling back to the
 * target table id for terms that predate the sourceDomain field. */
export function termSourceDomain(term: ExportTermRef): string {
  return term.sourceDomain ?? term.domain;
}

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
    if (!mapping || mapping.excluded || !mapping.targetTableId || mapping.targetTermIds.length === 0) continue;

    const table = tableById.get(mapping.targetTableId);
    if (!table) continue;

    for (const targetTermId of mapping.targetTermIds) {
      const newTerm = table.terms.find((candidate) => candidate.id === targetTermId);
      if (!newTerm) continue;
      out.push({ domain: table.id, nicename: newTerm.slug || newTerm.id, name: newTerm.name, sourceDomain: term.domain });
    }
  }

  return out;
}
