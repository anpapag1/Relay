import http from 'node:http';
import { fetchPageMedia, type PageMediaResult } from './fetchPageMedia';
import { checkImage, type CheckImageResult } from './checkImage';
import { getCached, setCached } from './cache';

const PORT = Number(process.env.PORT ?? 8787);

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handlePageMedia(target: string, res: http.ServerResponse): Promise<void> {
  const cached = getCached<PageMediaResult>(target);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  const result = await fetchPageMedia(target, {});
  if (result.status === 200) {
    setCached(target, result.body);
    sendJson(res, 200, result.body);
  } else {
    sendJson(res, result.status, { error: result.reason });
  }
}

/** Unlike /api/page-media, this route always answers 200 with a JSON body
 * describing the outcome (`{ok, status?, reason?}`) instead of mapping
 * failures onto HTTP status codes — "the image is broken" is an expected,
 * valid answer here, not a proxy-level error. */
async function handleImageCheck(target: string, res: http.ServerResponse): Promise<void> {
  const cacheKey = `image-check:${target}`;
  const cached = getCached<CheckImageResult>(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  const result = await checkImage(target);
  if (result.ok) {
    setCached(cacheKey, result);
  }
  sendJson(res, 200, result);
}

/** The two routes this proxy exists for (design spec §5.7, and the
 * broken-image-detection design): fetching an old-site page's media URLs,
 * and checking whether a single resolved image URL actually loads. Never
 * the media bytes themselves. Everything else (parsing, SSRF guarding,
 * timeouts, caching) lives in fetchPageMedia.ts/checkImage.ts/guard.ts/
 * cache.ts; this file is just the HTTP entry point. */
const server = http.createServer((req, res) => {
  void (async () => {
    if (req.method !== 'GET' || !req.url) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    const target = requestUrl.searchParams.get('url');

    if (requestUrl.pathname === '/api/page-media') {
      if (!target) {
        sendJson(res, 400, { error: 'missing "url" query parameter' });
        return;
      }
      await handlePageMedia(target, res);
      return;
    }

    if (requestUrl.pathname === '/api/image-check') {
      if (!target) {
        sendJson(res, 400, { error: 'missing "url" query parameter' });
        return;
      }
      await handleImageCheck(target, res);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  })();
});

server.listen(PORT, () => {
  console.log(`Relay media proxy listening on http://localhost:${PORT}`);
});

export { server };
