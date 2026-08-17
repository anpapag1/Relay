import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
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

  it('surfaces upstream X-WP-TotalPages / X-WP-Total headers on a 200 result', async () => {
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'application/json; charset=UTF-8',
        'x-wp-total-pages': '12',
        'x-wp-total': '1102',
      });
      res.end('[]');
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const address = upstream.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    try {
      const res = await fetchUrl(`http://127.0.0.1:${port}/posts`);
      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(res.xWpTotalPages).toBe('12');
        expect(res.xWpTotal).toBe('1102');
        expect(res.contentType).toMatch(/application\/json/);
        expect(res.body).toBe('[]');
      }
    } finally {
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  });
});
