import { describe, it, expect } from 'vitest';
import { fetchRestTaxonomies } from './fetchRestTaxonomies';
import type { TextFetchLike } from './types';

function taxonomyFetch(pages: Record<string, unknown[]>): { fetchImpl: TextFetchLike; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl: TextFetchLike = async (input) => {
    urls.push(input);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(pages[input] ?? []),
    };
  };
  return { fetchImpl, urls };
}

describe('fetchRestTaxonomies', () => {
  it('resolves categories and tags into id → {nicename, name} maps', async () => {
    const { fetchImpl, urls } = taxonomyFetch({
      'https://site.example/wp-json/wp/v2/categories?per_page=100&page=1&_fields=id,name,slug':
        [{ id: 13, name: 'Αθλητισμός', slug: 'athlitismos' }],
      'https://site.example/wp-json/wp/v2/tags?per_page=100&page=1&_fields=id,name,slug':
        [{ id: 55, name: 'Ανακοίνωση', slug: 'anakoinosi' }],
    });

    const result = await fetchRestTaxonomies('https://site.example/wp-json/wp/v2', fetchImpl);
    expect(result.category.get(13)).toEqual({ nicename: 'athlitismos', name: 'Αθλητισμός' });
    expect(result.post_tag.get(55)).toEqual({ nicename: 'anakoinosi', name: 'Ανακοίνωση' });
    expect(urls).toContain('https://site.example/wp-json/wp/v2/categories?per_page=100&page=1&_fields=id,name,slug');
  });

  it('paginates a taxonomy until an empty page', async () => {
    const { fetchImpl, urls } = taxonomyFetch({
      'https://site.example/wp-json/wp/v2/categories?per_page=100&page=1&_fields=id,name,slug':
        [{ id: 1, name: 'A', slug: 'a' }, { id: 2, name: 'B', slug: 'b' }],
      'https://site.example/wp-json/wp/v2/categories?per_page=100&page=2&_fields=id,name,slug':
        [{ id: 3, name: 'C', slug: 'c' }],
      'https://site.example/wp-json/wp/v2/categories?per_page=100&page=3&_fields=id,name,slug': [],
    });

    const result = await fetchRestTaxonomies('https://site.example/wp-json/wp/v2', fetchImpl);
    expect(result.category.size).toBe(3);
    expect(result.category.get(3)).toEqual({ nicename: 'c', name: 'C' });
    expect(urls).toContain('https://site.example/wp-json/wp/v2/categories?per_page=100&page=2&_fields=id,name,slug');
  });

  it('keeps terms with missing slug/name and tolerates a failed taxonomy endpoint', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      if (input.includes('/tags')) return { ok: false, status: 404, headers: { get: () => null }, text: async () => '' };
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify([{ id: 9, name: 'Μόνο', slug: '' }]),
      };
    };
    const result = await fetchRestTaxonomies('https://site.example/wp-json/wp/v2', fetchImpl);
    expect(result.category.get(9)).toEqual({ nicename: '', name: 'Μόνο' });
    expect(result.post_tag.size).toBe(0);
  });
});