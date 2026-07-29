import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { fetchPageMedia } from './fetchPageMedia';
import { guardUrl } from './guard';

vi.mock('./guard', () => ({
  guardUrl: vi.fn(),
}));

describe('fetchPageMedia', () => {
  let server: http.Server;
  let baseUrl: string;
  const activeTimers = new Set<NodeJS.Timeout>();

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1`);

      if (url.pathname === '/success') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:image" content="/assets/og.png" />
            </head>
            <body>
              <img src="https://other.com/img1.jpg" />
              <img src="/img2.png" />
              <img src="/img2.png" /> <!-- duplicate to test dedup -->
              <a href="/docs/guide.pdf">Guide</a>
              <a href="archive.zip?v=1">Archive</a>
              <a href="/page.html">Not a file link</a>
            </body>
          </html>
        `);
        return;
      }

      if (url.pathname === '/subfolder/page.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(`
          <img src="relative-img.jpg" />
          <a href="../doc.docx">Word doc</a>
        `);
        return;
      }

      if (url.pathname === '/500') {
        res.writeHead(500, { 'content-type': 'text/html' });
        res.end('Server Error');
        return;
      }

      if (url.pathname === '/404') {
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end('Not Found');
        return;
      }

      if (url.pathname === '/json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (url.pathname === '/redirect-1') {
        res.writeHead(302, { location: '/success' });
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

      if (url.pathname === '/big') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.write('x'.repeat(500));
        setTimeout(() => {
          res.write('y'.repeat(500));
          res.end();
        }, 10);
        return;
      }

      if (url.pathname === '/timeout') {
        // Delay responding past the tiny test timeout
        const timer = setTimeout(() => {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end('Late response');
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

  it('should successfully extract og:image, images, and files with deduplication and absolute resolution', async () => {
    const res = await fetchPageMedia(`${baseUrl}/success`, {});
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.body).toEqual({
        ogImage: `${baseUrl}/assets/og.png`,
        images: ['https://other.com/img1.jpg', `${baseUrl}/img2.png`],
        files: [`${baseUrl}/docs/guide.pdf`, `${baseUrl}/archive.zip?v=1`],
      });
    }
  });

  it('should resolve relative src and href against a subfolder base URL', async () => {
    const res = await fetchPageMedia(`${baseUrl}/subfolder/page.html`, {});
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.body.images).toEqual([`${baseUrl}/subfolder/relative-img.jpg`]);
      expect(res.body.files).toEqual([`${baseUrl}/doc.docx`]);
    }
  });

  it('should return 400 when guardUrl refuses the URL', async () => {
    vi.mocked(guardUrl).mockResolvedValueOnce({ ok: false, reason: 'evil.com resolved to a private/loopback/link-local address' });
    const res = await fetchPageMedia('http://evil.com/page', {});
    expect(res).toEqual({ status: 400, reason: 'evil.com resolved to a private/loopback/link-local address' });
  });

  it('should return 502 for non-2xx upstream responses', async () => {
    const res500 = await fetchPageMedia(`${baseUrl}/500`, {});
    expect(res500).toEqual({ status: 502, reason: 'the old site responded with status 500' });

    const res404 = await fetchPageMedia(`${baseUrl}/404`, {});
    expect(res404).toEqual({ status: 502, reason: 'the old site responded with status 404' });
  });

  it('should return 502 when content-type is not text/html', async () => {
    const res = await fetchPageMedia(`${baseUrl}/json`, {});
    expect(res).toEqual({ status: 502, reason: 'unexpected content-type: application/json' });
  });

  it('should follow redirects up to maxRedirects', async () => {
    const res = await fetchPageMedia(`${baseUrl}/redirect-1`, {});
    expect(res.status).toBe(200);
    expect(guardUrl).toHaveBeenCalledTimes(2);
  });

  it('should return 502 when maxRedirects is exceeded', async () => {
    const res = await fetchPageMedia(`${baseUrl}/redirect-loop`, { maxRedirects: 2 });
    expect(res).toEqual({ status: 502, reason: 'too many redirects' });
    expect(guardUrl).toHaveBeenCalledTimes(3); // initial + 2 hops
  });

  it('should return 502 when redirect is missing Location header', async () => {
    const res = await fetchPageMedia(`${baseUrl}/redirect-no-location`, {});
    expect(res).toEqual({ status: 502, reason: 'redirect with no Location header (status 302)' });
  });

  it('should return 502 when response body exceeds maxBytes cap', async () => {
    const res = await fetchPageMedia(`${baseUrl}/big`, { maxBytes: 100 });
    expect(res).toEqual({ status: 502, reason: 'response exceeded the size cap' });
  });

  it('should return 504 when request times out', async () => {
    const res = await fetchPageMedia(`${baseUrl}/timeout`, { timeoutMs: 50 });
    expect(res).toEqual({ status: 504, reason: 'the old site did not respond in time' });
  });
});
