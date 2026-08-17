import { describe, it, expect } from 'vitest';
import { fetchRestPosts } from './fetchRestPosts';
import type { TextFetchLike } from './types';

function restFetch(pages: Record<number, unknown[]>, totalPages: string): TextFetchLike {
  return async (input) => {
    const page = Number(new URL(input).searchParams.get('page') ?? '1');
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name.toLowerCase() === 'x-wp-totalpages' ? totalPages : null) },
      text: async () => JSON.stringify(pages[page] ?? []),
    };
  };
}

describe('fetchRestPosts', () => {
  it('paginates until the last page', async () => {
    const pages = {
      1: [{ id: 1, title: { rendered: 'one' } }],
      2: [{ id: 2, title: { rendered: 'two' } }],
    };
    const res = await fetchRestPosts('https://site.example/wp-json/wp/v2', restFetch(pages, '2'));
    expect(res.posts.map((p) => p.id)).toEqual([1, 2]);
    expect(res.truncated).toBe(false);
  });

  it('stops at the anonymous 100-page cap and reports truncation', async () => {
    const pages: Record<number, unknown[]> = {};
    for (let i = 1; i <= 100; i += 1) pages[i] = [{ id: i }];
    const res = await fetchRestPosts('https://site.example/wp-json/wp/v2', restFetch(pages, '120'));
    expect(res.truncated).toBe(true);
    expect(res.posts.length).toBe(100);
  });

  it('reports progress via onProgress', async () => {
    const seen: number[] = [];
    const pages = { 1: [{ id: 1 }], 2: [{ id: 2 }] };
    await fetchRestPosts('https://site.example/wp-json/wp/v2', restFetch(pages, '2'), (p) => seen.push(p.fetched));
    expect(seen).toEqual([1, 2]);
  });
});