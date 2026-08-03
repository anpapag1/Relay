import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { clearCache } from './cache';
import { checkImage } from './checkImage';

process.env.PORT = '0';

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
  });

  beforeEach(() => {
    clearCache();
    vi.mocked(checkImage).mockClear();
  });

  it('responds 404 for an unknown route', async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    expect(res.status).toBe(404);
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
});
