import { describe, expect, it } from 'vitest';
import { fetchPageMedia, type FetchLike } from './mediaClient';

function stubFetch(handler: FetchLike): FetchLike {
  return handler;
}

describe('fetchPageMedia', () => {
  it('returns the parsed media on a 200 response', async () => {
    const fetchImpl = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ogImage: 'https://old.example/og.jpg', images: ['https://old.example/a.jpg'], files: [] }),
    }));
    const result = await fetchPageMedia('https://old.example/post/', fetchImpl);
    expect(result).toEqual({
      ok: true,
      media: { ogImage: 'https://old.example/og.jpg', images: ['https://old.example/a.jpg'], files: [] },
    });
  });

  it('reports "refused" for a 400 response', async () => {
    const fetchImpl = stubFetch(async () => ({ ok: false, status: 400, json: async () => ({}) }));
    const result = await fetchPageMedia('https://blocked.example/', fetchImpl);
    expect(result).toEqual({ ok: false, reason: 'refused' });
  });

  it('reports "unreachable" for a 502/504 response', async () => {
    const fetchImpl = stubFetch(async () => ({ ok: false, status: 502, json: async () => ({}) }));
    const result = await fetchPageMedia('https://down.example/', fetchImpl);
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('reports "unreachable" when fetch itself throws', async () => {
    const fetchImpl = stubFetch(async () => {
      throw new Error('network error');
    });
    const result = await fetchPageMedia('https://timeout.example/', fetchImpl);
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('reports "unreachable" for a malformed 200 body', async () => {
    const fetchImpl = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }));
    const result = await fetchPageMedia('https://weird.example/', fetchImpl);
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
  });
});
