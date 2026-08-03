import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { checkImage } from './checkImage';
import { guardUrl } from './guard';

vi.mock('./guard', () => ({
  guardUrl: vi.fn(),
}));

describe('checkImage', () => {
  let server: http.Server;
  let baseUrl: string;
  const activeTimers = new Set<NodeJS.Timeout>();

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (url.pathname === '/photo.jpg') {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        res.end();
        return;
      }

      if (url.pathname === '/not-an-image.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end();
        return;
      }

      if (url.pathname === '/redirect-to-photo') {
        res.writeHead(302, { location: '/photo.jpg' });
        res.end();
        return;
      }

      if (url.pathname === '/redirect-loop') {
        res.writeHead(302, { location: '/redirect-loop' });
        res.end();
        return;
      }

      if (url.pathname === '/redirect-no-location') {
        res.writeHead(302, {});
        res.end();
        return;
      }

      if (url.pathname === '/timeout') {
        const timer = setTimeout(() => {
          res.writeHead(200, { 'content-type': 'image/jpeg' });
          res.end();
        }, 1000);
        activeTimers.add(timer);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const timer of activeTimers) clearTimeout(timer);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  });

  beforeEach(() => {
    vi.mocked(guardUrl).mockReset();
    vi.mocked(guardUrl).mockResolvedValue({ ok: true, ip: '127.0.0.1' });
  });

  it('returns ok:true for a 200 response with an image content-type', async () => {
    const res = await checkImage(`${baseUrl}/photo.jpg`);
    expect(res).toEqual({ ok: true, status: 200 });
  });

  it('returns ok:false with the status for a 404', async () => {
    const res = await checkImage(`${baseUrl}/missing.jpg`);
    expect(res).toEqual({ ok: false, status: 404, reason: 'the old site responded with status 404' });
  });

  it('returns ok:false when the content-type is not image/*', async () => {
    const res = await checkImage(`${baseUrl}/not-an-image.html`);
    expect(res).toEqual({ ok: false, status: 200, reason: 'unexpected content-type: text/html' });
  });

  it('returns ok:false when guardUrl refuses the URL', async () => {
    vi.mocked(guardUrl).mockResolvedValueOnce({ ok: false, reason: 'evil.com resolved to a private address' });
    const res = await checkImage('http://evil.com/img.jpg');
    expect(res).toEqual({ ok: false, reason: 'evil.com resolved to a private address' });
  });

  it('follows a redirect to a valid image', async () => {
    const res = await checkImage(`${baseUrl}/redirect-to-photo`);
    expect(res).toEqual({ ok: true, status: 200 });
    expect(guardUrl).toHaveBeenCalledTimes(2);
  });

  it('returns ok:false when maxRedirects is exceeded', async () => {
    const res = await checkImage(`${baseUrl}/redirect-loop`, { maxRedirects: 2 });
    expect(res).toEqual({ ok: false, reason: 'too many redirects' });
    expect(guardUrl).toHaveBeenCalledTimes(3);
  });

  it('returns ok:false when a redirect has no Location header', async () => {
    const res = await checkImage(`${baseUrl}/redirect-no-location`);
    expect(res).toEqual({ ok: false, status: 302, reason: 'redirect with no Location header' });
  });

  it('returns ok:false when the request times out', async () => {
    const res = await checkImage(`${baseUrl}/timeout`, { timeoutMs: 50 });
    expect(res).toEqual({ ok: false, reason: 'the old site did not respond in time' });
  });
});
