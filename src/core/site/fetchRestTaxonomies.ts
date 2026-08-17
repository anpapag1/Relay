import type { TextFetchLike } from './types';

export interface RestTaxonItem {
  id: number;
  name: string;
  slug: string;
}

export interface ResolvedTerm {
  nicename: string;
  name: string;
}

export type TaxonomyMaps = Record<string, Map<number, ResolvedTerm>>;

/** The REST endpoint each built-in taxonomy lives under. The single source
 * of truth for the category/post_tag → categories/tags mapping — consumed
 * both by fetchRestTaxonomies (paginate the term lists) and by
 * mapToParseResult (resolve a post's id arrays to term names). */
export const TAXONOMIES = [
  { domain: 'category', path: 'categories', field: 'categories' },
  { domain: 'post_tag', path: 'tags', field: 'tags' },
] as const;

async function fetchTaxonomy(
  apiBase: string,
  path: string,
  fetchImpl: TextFetchLike,
): Promise<Map<number, ResolvedTerm>> {
  const terms = new Map<number, ResolvedTerm>();
  for (let page = 1; page <= 100; page += 1) {
    const url = `${apiBase}/${path}?per_page=100&page=${page}&_fields=id,name,slug`;
    const res = await fetchImpl(url);
    if (!res.ok) break;
    const batch = JSON.parse(await res.text()) as RestTaxonItem[];
    if (batch.length === 0) break;
    for (const item of batch) {
      terms.set(item.id, { nicename: item.slug, name: item.name });
    }
  }
  return terms;
}

/** Fetches the site's category and post_tag term lists (id → {nicename,
 * name}) so post `categories`/`tags` ID arrays can be resolved to real
 * term names. Never throws: a failed taxonomy endpoint yields an empty map
 * for that taxonomy. */
export async function fetchRestTaxonomies(
  apiBase: string,
  fetchImpl: TextFetchLike,
): Promise<TaxonomyMaps> {
  const result: TaxonomyMaps = {};
  for (const { domain, path } of TAXONOMIES) {
    result[domain] = await fetchTaxonomy(apiBase, path, fetchImpl);
  }
  return result;
}