import { describe, it, expect } from 'vitest';
import { probeSite } from './probeSite';
import type { TextFetchLike } from './types';

function jsonFetch(status: number, body: unknown): TextFetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  });
}

function xmlFetch(body: string): TextFetchLike {
  return async () => ({ ok: true, status: 200, headers: { get: () => 'text/xml' }, text: async () => body });
}

describe('probeSite', () => {
  it('detects a pretty-permalink REST API', async () => {
    const calls: string[] = [];
    const fetchImpl: TextFetchLike = (input) => {
      calls.push(input);
      return jsonFetch(200, [{ id: 1 }])(input);
    };
    const res = await probeSite('https://site.example', fetchImpl);
    expect(res).toEqual({ ok: true, source: 'rest', apiBase: 'https://site.example/wp-json/wp/v2' });
    expect(calls[0]).toContain('/wp-json/wp/v2/posts?per_page=1');
  });

  it('falls back to index.php?rest_route when pretty permalinks 404', async () => {
    const calls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      calls.push(input);
      return input.includes('/wp-json/')
        ? jsonFetch(404, { code: 'rest_no_route' })(input)
        : jsonFetch(200, [{ id: 1 }])(input);
    };
    const res = await probeSite('https://site.example', fetchImpl);
    expect(res.ok && res.source === 'rest').toBe(true);
    if (res.ok && res.source === 'rest') {
      expect(res.apiBase).toBe('https://site.example/index.php?rest_route=/wp/v2');
    }
  });

  it('falls back to the RSS feed when REST is unavailable', async () => {
    const calls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      calls.push(input);
      if (input.includes('wp-json') || input.includes('rest_route')) {
        return jsonFetch(404, { code: 'rest_disabled' })(input);
      }
      return xmlFetch('<rss version="2.0"><channel><title>t</title></channel></rss>')(input);
    };
    const res = await probeSite('https://site.example', fetchImpl);
    expect(res).toEqual({ ok: true, source: 'rss', feedUrl: 'https://site.example/feed/' });
  });

  it('does not claim rss for an Atom <feed> the parser cannot read', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      if (input.includes('wp-json') || input.includes('rest_route')) {
        return jsonFetch(404, { code: 'rest_disabled' })(input);
      }
      return xmlFetch('<feed xmlns="http://www.w3.org/2005/Atom"><title>t</title></feed>')(input);
    };
    const res = await probeSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(false);
  });

  it('reports failure when nothing is reachable', async () => {
    const fetchImpl: TextFetchLike = async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => 'nope' });
    const res = await probeSite('https://site.example', fetchImpl);
    expect(res.ok).toBe(false);
  });
});
