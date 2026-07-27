import type { TermRef } from '../../types/domain';

/** The key mappings are stored under — one entry per (domain, nicename)
 * pair, since a term's nicename is only unique within its own taxonomy
 * domain. */
export function termMappingId(domain: string, nicename: string): string {
  return `${domain}:${nicename}`;
}

export function termMappingIdOf(term: TermRef): string {
  return termMappingId(term.domain, term.nicename);
}
