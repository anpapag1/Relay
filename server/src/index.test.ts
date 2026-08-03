import { describe, it, expect, beforeAll, afterAll } from 'vitest';

process.env.PORT = '0';

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
});
