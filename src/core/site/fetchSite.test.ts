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

  it('returns ok:false, not an unhandled rejection, when the posts fetch rejects after a successful probe', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      const url = new URL(input);
      const isProbe = url.searchParams.get('per_page') === '1' && !url.searchParams.has('page');
      if (isProbe) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 1 }]' };
      }
      throw new Error('connection reset');
    };
    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('connection reset');
  });

  it('returns ok:false when the posts fetch returns a 200 with a non-JSON body', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      const url = new URL(input);
      const isProbe = url.searchParams.get('per_page') === '1' && !url.searchParams.has('page');
      if (isProbe) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 1 }]' };
      }
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => '<html>not json</html>' };
    };
    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(false);
  });

  it('returns ok:false, not an unhandled rejection, when the feed fetch rejects after an RSS probe', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      const url = new URL(input);
      if (url.pathname.startsWith('/wp-json') || url.pathname.startsWith('/index.php')) {
        return { ok: false, status: 404, headers: { get: () => null }, text: async () => 'nope' };
      }
      if (url.pathname.startsWith('/feed')) {
        if (url.searchParams.has('paged')) throw new Error('feed page failed');
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '<rss version="2.0"><channel><item><title>T</title></item></channel></rss>' };
      }
      throw new Error('unexpected url');
    };
    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('feed page failed');
  });

  it('passes the filter to the REST posts query', async () => {
    const urls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      urls.push(input);
      const url = new URL(input);
      if (url.searchParams.get('per_page') === '1' && !url.searchParams.has('page')) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 1 }]' };
      }
      return {
        ok: true, status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => '[]',
      };
    };
    const res = await fetchSite('https://site.example', fetchImpl, undefined, {
      startDate: '2020-01-01',
      endDate: '2020-02-01',
    });
    expect(res.ok).toBe(true);
    const postsUrl = urls.find((u) => u.includes('per_page=100'));
    expect(postsUrl).toBeDefined();
    expect(postsUrl).toContain('after=2020-01-01T00:00:00');
    expect(postsUrl).toContain('before=2020-02-01T23:59:59');
  });

  it('maps the post status into the ParseResult article', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      const url = new URL(input);
      if (url.searchParams.get('per_page') === '1' && !url.searchParams.has('page')) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 1 }]' };
      }
      return {
        ok: true, status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => JSON.stringify([{
          id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
          title: { rendered: 'Hello' }, content: { rendered: '<p>Hi</p>' }, featured_media: 0, status: 'draft',
        }]),
      };
    };
    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.articles[0].status).toBe('draft');
    expect(res.result.statusCounts).toEqual({ draft: 1 });
  });

  it('resolves post category/tag IDs into article terms and aggregates taxonomies', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      const url = new URL(input);
      if (url.searchParams.get('per_page') === '1' && !url.searchParams.has('page')) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '[{ "id": 1 }]' };
      }
      if (url.pathname.endsWith('/categories')) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify([
          { id: 13, name: 'Αθλητισμός', slug: 'athlitismos' },
          { id: 75, name: 'Εκδηλώσεις', slug: 'ekdiloseis' },
        ]) };
      }
      if (url.pathname.endsWith('/tags')) {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify([
          { id: 55, name: 'Ανακοίνωση', slug: 'anakoinosi' },
        ]) };
      }
      return {
        ok: true, status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'x-wp-totalpages' ? '1' : null) },
        text: async () => JSON.stringify([
          { id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/', title: { rendered: 'Hello' }, content: { rendered: '<p>Hi</p>' }, featured_media: 0, status: 'publish', categories: [13, 75], tags: [55] },
          { id: 8, date: '2026-08-17T09:00:00', slug: 'again', link: 'https://site.example/again/', title: { rendered: 'Again' }, content: { rendered: '<p>Hi</p>' }, featured_media: 0, status: 'publish', categories: [13], tags: [] },
        ]),
      };
    };
    const res = await fetchSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.articles[0].terms).toEqual([
      { domain: 'category', nicename: 'athlitismos', name: 'Αθλητισμός' },
      { domain: 'category', nicename: 'ekdiloseis', name: 'Εκδηλώσεις' },
      { domain: 'post_tag', nicename: 'anakoinosi', name: 'Ανακοίνωση' },
    ]);
    expect(res.result.articles[1].terms).toEqual([{ domain: 'category', nicename: 'athlitismos', name: 'Αθλητισμός' }]);
    expect(res.result.taxonomies.category).toEqual([
      { nicename: 'athlitismos', name: 'Αθλητισμός', count: 2 },
      { nicename: 'ekdiloseis', name: 'Εκδηλώσεις', count: 1 },
    ]);
    expect(res.result.taxonomies.post_tag).toEqual([{ nicename: 'anakoinosi', name: 'Ανακοίνωση', count: 1 }]);
  });
});
