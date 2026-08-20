import { describe, it, expect } from 'vitest';
import { fetchFeaturedImageUrls } from './fetchRestMedia';
import type { TextFetchLike } from './types';

describe('fetchFeaturedImageUrls', () => {
  it('batches ids into include chunks of 10, maps id -> source_url, and reports cumulative progress', async () => {
    const calls: string[] = [];
    const progress: number[] = [];
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    const fetchImpl: TextFetchLike = async (input) => {
      calls.push(input);
      const include = new URL(input).searchParams.get('include') ?? '';
      const items = include.split(',').map((id) => ({ id: Number(id), source_url: `https://cdn.example/${id}.jpg` }));
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(items) };
    };
    const map = await fetchFeaturedImageUrls('https://site.example/wp-json/wp/v2', ids, fetchImpl, (n) => progress.push(n));
    expect(calls).toHaveLength(3);
    expect(map.get(25)).toBe('https://cdn.example/25.jpg');
    expect(progress).toEqual([10, 20, 25]);
  });

  it('keeps every batch within WordPress\'s default per_page so an include batch is not silently truncated', async () => {
    const urls: string[] = [];
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    const fetchImpl: TextFetchLike = async (input) => {
      urls.push(input);
      const include = new URL(input).searchParams.get('include') ?? '';
      const items = include.split(',').map((id) => ({ id: Number(id), source_url: `https://cdn.example/${id}.jpg` }));
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(items) };
    };
    await fetchFeaturedImageUrls('https://site.example/wp-json/wp/v2', ids, fetchImpl);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('per_page=10');
    expect(urls[0]).toContain('include=1,2,3,4,5,6,7,8,9,10');
    expect(urls[2]).toContain('include=21');
  });

  it('reports only the ids the server actually resolved, so the count stays honest', async () => {
    const progress: number[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      const include = new URL(input).searchParams.get('include') ?? '';
      const items = include.split(',').filter((id) => Number(id) !== 2).map((id) => ({ id: Number(id), source_url: `https://cdn.example/${id}.jpg` }));
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(items) };
    };
    const map = await fetchFeaturedImageUrls('https://site.example/wp-json/wp/v2', [1, 2, 3], fetchImpl, (n) => progress.push(n));
    expect(map.has(2)).toBe(false);
    expect(progress).toEqual([2]);
  });
});