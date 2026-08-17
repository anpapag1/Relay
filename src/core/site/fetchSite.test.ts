import { describe, it, expect, vi } from 'vitest';
import { fetchSite } from './fetchSite';
import type { TextFetchLike } from './types';

describe('fetchSite', () => {
  it('probes, paginates REST posts, resolves featured images, and maps to ParseResult', async () => {
    const fetchImpl: TextFetchLike = vi.fn(async (input) => {
      const url = new URL(input);
      const isMedia = url.pathname.includes('/media');
      const isProbe = url.searchParams.get('per_page') === '1' && !url.searchParams.has('page');
      if (isProbe) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 1 }]' };
      }
      if (isMedia) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 7, "source_url": "https://cdn.example/7.jpg" }]' };
      }
      return {
        ok: true, status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => JSON.stringify([{
          id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
          title: { rendered: 'Hello' }, content: { rendered: '<p>Hi</p>' }, featured_media: 7, status: 'publish',
        }]),
      };
    });

    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe('rest');
    expect(res.truncated).toBe(false);
    expect(res.result.articles[0].featuredImageUrl).toBe('https://cdn.example/7.jpg');
  });

  it('surfaces a probe failure', async () => {
    const fetchImpl: TextFetchLike = async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => 'nope' });
    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(false);
  });
});
