import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { clearCache } from './cache';
import { checkImage } from './checkImage';
import { fetchUrl } from './fetchUrl';

process.env.PORT = '0';

// Point static serving at a throwaway SPA fixture (created before the
// dynamic import of ./index in beforeAll, since index reads STATIC_DIR at
// module load).
const staticFixture = mkdtempSync(path.join(tmpdir(), 'relay-static-'));
writeFileSync(path.join(staticFixture, 'index.html'), '<!doctype html><title>Relay</title>');
writeFileSync(path.join(staticFixture, 'app.js'), 'console.log("hi");');
process.env.STATIC_DIR = staticFixture;

// Wrap the real checkImage in a spy (rather than replacing it outright) so
// the pre-existing "unreachable URL" test below still exercises real
// behavior, while the caching tests can assert on call counts to prove
// success is cached and failure is not (Finding 2 of the final review).
vi.mock('./checkImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./checkImage')>();
  return {
    ...actual,
    checkImage: vi.fn(actual.checkImage),
  };
});

// Same wrapper trick for fetchUrl: the route tests that need real behavior
// (SSRF guard on 127.0.0.1) keep it, while the header-forwarding and body-cap
// tests override the single call with a canned 200 result.
vi.mock('./fetchUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fetchUrl')>();
  return {
    ...actual,
    fetchUrl: vi.fn(actual.fetchUrl),
  };
});

describe('server routes', () => {
  let baseUrl: string;

  beforeAll(async () => {
    const { server } = await import('./index');
    await new Promise<void>((resolve) => {
      if (server.listening) return resolve();
      server.once('listening', () => resolve());
    });
    const address = server.address();
    if (address && typeof address !== 'string') {
      baseUrl = `http://127.0.0.1:${address.port}`;
    }
  });

  afterAll(async () => {
    const { server } = await import('./index');
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
    rmSync(staticFixture, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearCache();
    vi.mocked(checkImage).mockClear();
    vi.mocked(fetchUrl).mockClear();
  });

  it('responds 404 for an unknown route', async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    expect(res.status).toBe(404);
  });

  it('responds 200 with a JSON health body for /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('logs each request as a structured JSON line', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let logLine: unknown;

    try {
      await fetch(`${baseUrl}/health`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      logLine = writeSpy.mock.calls.find(([chunk]) => {
        if (typeof chunk !== 'string') return false;
        try {
          return (JSON.parse(chunk) as { event?: string }).event === 'request';
        } catch {
          return false;
        }
      });
    } finally {
      writeSpy.mockRestore();
    }

    expect(logLine).toBeDefined();
    const parsed = JSON.parse(logLine![0] as string) as { method: string; path: string; status: number };
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/health');
    expect(parsed.status).toBe(200);
  });

  it('responds 400 for /api/image-check with no url param', async () => {
    const res = await fetch(`${baseUrl}/api/image-check`);
    expect(res.status).toBe(400);
  });

  it('responds 200 with a JSON body for /api/image-check on an unreachable URL', async () => {
    const res = await fetch(`${baseUrl}/api/image-check?url=${encodeURIComponent('http://127.0.0.1:1/nope.jpg')}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('caches a successful /api/image-check result: checkImage is only called once for repeated requests', async () => {
    vi.mocked(checkImage).mockResolvedValue({ ok: true, status: 200 });
    const url = 'https://old.example/ok-cached.jpg';

    const first = await fetch(`${baseUrl}/api/image-check?url=${encodeURIComponent(url)}`);
    const second = await fetch(`${baseUrl}/api/image-check?url=${encodeURIComponent(url)}`);

    expect((await first.json()) as { ok: boolean }).toEqual({ ok: true, status: 200 });
    expect((await second.json()) as { ok: boolean }).toEqual({ ok: true, status: 200 });
    expect(checkImage).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed /api/image-check result: checkImage is called again on the next request', async () => {
    vi.mocked(checkImage).mockResolvedValue({
      ok: false,
      status: 404,
      reason: 'the old site responded with status 404',
    });
    const url = 'https://old.example/broken-not-cached.jpg';

    await fetch(`${baseUrl}/api/image-check?url=${encodeURIComponent(url)}`);
    await fetch(`${baseUrl}/api/image-check?url=${encodeURIComponent(url)}`);

    expect(checkImage).toHaveBeenCalledTimes(2);
  });

  it('responds 400 for /api/fetch with no url param', async () => {
    const res = await fetch(`${baseUrl}/api/fetch`);
    expect(res.status).toBe(400);
  });

  it('responds 400 for /api/fetch on a private URL', async () => {
    const res = await fetch(`${baseUrl}/api/fetch?url=${encodeURIComponent('http://127.0.0.1:1/x')}`);
    expect(res.status).toBe(400);
  });

  it('forwards upstream X-WP-TotalPages / X-WP-Total headers through /api/fetch', async () => {
    vi.mocked(fetchUrl).mockResolvedValueOnce({
      status: 200,
      body: '[]',
      contentType: 'application/json; charset=UTF-8',
      xWpTotalPages: '12',
      xWpTotal: '1102',
    });

    const res = await fetch(`${baseUrl}/api/fetch?url=${encodeURIComponent('https://old.example/wp-json/wp/v2/posts')}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-wp-totalpages')).toBe('12');
    expect(res.headers.get('x-wp-total')).toBe('1102');
    expect(await res.text()).toBe('[]');
  });

  it('fetches /api/fetch targets with the raised 16MB body cap', async () => {
    vi.mocked(fetchUrl).mockResolvedValueOnce({
      status: 200,
      body: '[]',
      contentType: 'application/json; charset=UTF-8',
    });

    await fetch(`${baseUrl}/api/fetch?url=${encodeURIComponent('https://old.example/wp-json/wp/v2/posts')}`);

    expect(vi.mocked(fetchUrl)).toHaveBeenCalledWith('https://old.example/wp-json/wp/v2/posts', {
      maxBytes: 16 * 1024 * 1024,
    });
  });

  it('serves index.html at the root with the html content type', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('<title>Relay</title>');
  });

  it('serves a static asset with its own content type', async () => {
    const res = await fetch(`${baseUrl}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await res.text()).toBe('console.log("hi");');
  });

  it('falls back to index.html for unknown SPA client routes', async () => {
    const res = await fetch(`${baseUrl}/some/client/route`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('<title>Relay</title>');
  });

  it('blocks raw path traversal attempts from non-normalizing clients', async () => {
    const { port } = new URL(baseUrl);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/../../etc/passwd', method: 'GET' }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(404);
  });

  it('defuses percent-encoded traversal: never leaks files outside the static dir', async () => {
    const res = await fetch(`${baseUrl}/%2e%2e/%2e%2e/etc/passwd`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Relay</title>');
  });

  it('keeps unknown /api routes as JSON 404 instead of the SPA fallback', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/json');
  });
});
