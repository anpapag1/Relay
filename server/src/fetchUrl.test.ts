import { describe, it, expect, vi } from 'vitest';
import { fetchUrl } from './fetchUrl';

vi.mock('./guard', () => ({
  guardUrl: vi.fn(async (_raw: string) => ({ ok: true, ip: '1.2.3.4' })),
}));

describe('fetchUrl', () => {
  it('returns 400 when the guard refuses the URL', async () => {
    const { guardUrl } = await import('./guard');
    vi.mocked(guardUrl).mockResolvedValueOnce({ ok: false, reason: 'private' });
    const res = await fetchUrl('http://127.0.0.1/x');
    expect(res.status).toBe(400);
  });

  it('returns 502 for an unreachable host', async () => {
    const res = await fetchUrl('http://127.0.0.1:1/nope');
    expect(res.status).toBe(502);
  });

  it('returns 200 with body text and content-type for a live URL', async () => {
    const res = await fetchUrl('https://example.com/');
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.body).toContain('Example Domain');
      expect(res.contentType).toMatch(/text\/html/);
    }
  });
});
