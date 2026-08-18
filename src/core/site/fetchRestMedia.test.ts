import { describe, it, expect } from 'vitest';
import { fetchFeaturedImageUrls } from './fetchRestMedia';
import type { TextFetchLike } from './types';

describe('fetchFeaturedImageUrls', () => {
  it('batches ids into include chunks of 100 and maps id -> source_url', async () => {
    const calls: string[] = [];
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const fetchImpl: TextFetchLike = async (input) => {
      calls.push(input);
      const include = new URL(input).searchParams.get('include') ?? '';
      const items = include.split(',').map((id) => ({ id: Number(id), source_url: `https://cdn.example/${id}.jpg` }));
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(items) };
    };
    const map = await fetchFeaturedImageUrls('https://site.example/wp-json/wp/v2', ids, fetchImpl);
    expect(calls).toHaveLength(2);
    expect(map.get(150)).toBe('https://cdn.example/150.jpg');
  });

  it('asks for per_page=100 so a batch include is not silently capped at WordPress\'s default 10', async () => {
    const urls: string[] = [];
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    const fetchImpl: TextFetchLike = async (input) => {
      urls.push(input);
      const include = new URL(input).searchParams.get('include') ?? '';
      const items = include.split(',').map((id) => ({ id: Number(id), source_url: `https://cdn.example/${id}.jpg` }));
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(items) };
    };
    await fetchFeaturedImageUrls('https://site.example/wp-json/wp/v2', ids, fetchImpl);
    expect(urls[0]).toContain('per_page=100');
    expect(urls[0]).toContain('include=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21');
  });
});