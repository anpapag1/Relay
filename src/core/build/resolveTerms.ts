import type { ExportTermRef, TermMapping, TermRef, TermTable } from '../../types/domain';
import { termMappingIdOf } from '../mappings/termId';

/** The taxonomy the mapped term actually came from: the source term's
 * old-site domain (e.g. `category`, `post_tag`), falling back to the
 * target table id for terms that predate the sourceDomain field. */
export function termSourceDomain(term: ExportTermRef): string {
  return term.sourceDomain ?? term.domain;
}

/** User-selected destination categories/tags that replace the article's
 * mapped ones on export (see applyTermOverrides). The table ids follow the
 * app's target-table convention: `category` and `post_tag`, matching the
 * taxonomy domains written to the WXR. */
export interface TermOverrides {
  categoryIds?: string[];
  tagIds?: string[];
}

/** Applies per-article category/tag overrides on top of the mapping's
 * resolved terms. When an override is present (non-empty ids), every base
 * term of that taxonomy is dropped and replaced by the chosen destination
 * terms, resolved against the matching target table. Terms whose id no
 * longer resolves (deleted term/table) are dropped rather than guessed,
 * mirroring resolveArticleTerms. Terms of other taxonomies pass through
 * untouched. */
export function applyTermOverrides(
  baseTerms: ExportTermRef[],
  overrides: TermOverrides,
  newTables: TermTable[],
): ExportTermRef[] {
  const out = baseTerms.filter((term) => {
    const source = termSourceDomain(term);
    if (source === 'category' && overrides.categoryIds !== undefined) return false;
    if (source === 'post_tag' && overrides.tagIds !== undefined) return false;
    return true;
  });

  const tableByDomain = new Map(newTables.map((table) => [table.domain || table.id, table]));
  const pushResolved = (ids: string[] | undefined, wpTaxonomy: string, sourceDomain: string) => {
    if (!ids || ids.length === 0) return;
    const table = tableByDomain.get(wpTaxonomy);
    if (!table) return;
    for (const id of ids) {
      const term = table.terms.find((candidate) => candidate.id === id);
      if (!term) continue;
      out.push({ domain: table.domain || table.id, nicename: term.slug || term.id, name: term.name, sourceDomain });
    }
  };

  pushResolved(overrides.categoryIds, 'category', 'category');
  pushResolved(overrides.tagIds, 'post_tag', 'post_tag');
  return out;
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
      out.push({ domain: table.domain || table.id, nicename: newTerm.slug || newTerm.id, name: newTerm.name, sourceDomain: term.domain });
    }
  }

  return out;
}
