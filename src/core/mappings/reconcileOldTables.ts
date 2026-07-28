import type { TaxonomyTermSummary, TermTable } from '../../types/domain';

export interface MissingOldTerm {
  domain: string;
  nicename: string;
  name: string;
}

/** Terms the loaded WXR actually contains (`taxonomies`) that aren't yet
 * represented in `oldTables`, matched by slug within the same domain. If a
 * domain has no old table at all yet, every one of its terms counts as
 * missing — this is what lets an empty `oldTables` bootstrap the full set
 * on a fresh import, and a partially-populated one reconcile after a JSON
 * import or manual edit left it out of sync. */
export function findMissingOldTerms(
  taxonomies: Record<string, TaxonomyTermSummary[]>,
  oldTables: Record<string, TermTable>,
): MissingOldTerm[] {
  const missing: MissingOldTerm[] = [];

  for (const [domain, terms] of Object.entries(taxonomies)) {
    const table = oldTables[domain];
    const existingSlugs = new Set((table?.terms ?? []).map((term) => term.slug ?? term.id));

    for (const term of terms) {
      if (!existingSlugs.has(term.nicename)) {
        missing.push({ domain, nicename: term.nicename, name: term.name });
      }
    }
  }

  return missing;
}

function labelForDomain(domain: string): string {
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

/** Returns a new table array with every entry in `missing` appended into the
 * old table for its domain, creating that table first if none exists yet.
 * Pure — does not mutate `oldTables`. */
export function mergeMissingIntoOldTables(
  oldTables: Record<string, TermTable>,
  missing: MissingOldTerm[],
): TermTable[] {
  const result: Record<string, TermTable> = {};
  for (const [id, table] of Object.entries(oldTables)) {
    result[id] = { ...table, terms: [...table.terms] };
  }

  for (const item of missing) {
    if (!result[item.domain]) {
      result[item.domain] = { id: item.domain, label: labelForDomain(item.domain), terms: [] };
    }
    result[item.domain].terms.push({
      id: `${item.domain}:${item.nicename}`,
      name: item.name,
      slug: item.nicename,
    });
  }

  return Object.values(result);
}
