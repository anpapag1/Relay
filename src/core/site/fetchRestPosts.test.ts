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

  it('reports truncation at the cap when the total-pages header is absent', async () => {
    const pages: Record<number, unknown[]> = {};
    for (let i = 1; i <= 100; i += 1) pages[i] = [{ id: i }];
    const res = await fetchRestPosts('https://site.example/wp-json/wp/v2', restFetch(pages, ''));
    expect(res.truncated).toBe(true);
    expect(res.posts.length).toBe(100);
  });

  it('throws on a non-ok response instead of reporting truncation', async () => {
    const fetchImpl: TextFetchLike = async () => ({
      ok: false,
      status: 403,
      headers: { get: () => null },
      text: async () => 'forbidden',
    });
    await expect(fetchRestPosts('https://site.example/wp-json/wp/v2', fetchImpl)).rejects.toThrow(/HTTP 403/);
  });

  it('reports progress via onProgress', async () => {
    const seen: number[] = [];
    const pages = { 1: [{ id: 1 }], 2: [{ id: 2 }] };
    await fetchRestPosts('https://site.example/wp-json/wp/v2', restFetch(pages, '2'), (p) => seen.push(p.fetched));
    expect(seen).toEqual([1, 2]);
  });
});

describe('fetchRestPosts filters', () => {
  it('narrows by date range when a filter is given', async () => {
    const urls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      urls.push(input);
      const page = Number(new URL(input).searchParams.get('page') ?? '1');
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => JSON.stringify(page === 1 ? [{ id: 1 }] : []),
      };
    };
    const res = await fetchRestPosts('https://site.example/wp-json/wp/v2', fetchImpl, undefined, {
      startDate: '2020-01-01',
      endDate: '2020-02-01',
    });
    expect(res.posts.map((p) => p.id)).toEqual([1]);
    expect(urls[0]).toContain('after=2020-01-01T00:00:00');
    expect(urls[0]).toContain('before=2020-02-01T23:59:59');
  });

  it('omits filter params when no filter is given', async () => {
    const urls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      urls.push(input);
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => '[]',
      };
    };
    await fetchRestPosts('https://site.example/wp-json/wp/v2', fetchImpl);
    expect(urls[0]).not.toContain('after=');
    expect(urls[0]).not.toContain('before=');
  });

  it('always fetches published posts (no status param is sent)', async () => {
    const urls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      urls.push(input);
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => '[]',
      };
    };
    await fetchRestPosts('https://site.example/wp-json/wp/v2', fetchImpl, undefined, {
      startDate: '2020-01-01',
      endDate: '2020-02-01',
    });
    expect(urls[0]).not.toContain('status=');
  });
});