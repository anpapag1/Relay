import http from 'node:http';
import { fetchPageMedia, type PageMediaResult } from './fetchPageMedia';
import { checkImage, type CheckImageResult } from './checkImage';
import { fetchUrl } from './fetchUrl';
import { getCached, setCached } from './cache';

const PORT = Number(process.env.PORT ?? 8787);

/** A 100-post REST page with rendered content can exceed the 3MB default,
 * so /api/fetch (unlike /api/page-media and /api/image-check) raises its
 * own body cap. */
const FETCH_MAX_BYTES = 16 * 1024 * 1024;

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

/** Unfiltered passthrough of an old-site URL's body (JSON or XML for the
 * importers). Unlike /api/page-media this is deliberately not cached: the
 * client paginates through the site and pages can change between reads. */
async function handleFetch(target: string, res: http.ServerResponse): Promise<void> {
  const result = await fetchUrl(target, { maxBytes: FETCH_MAX_BYTES });
  if (result.status === 200) {
    const headers: Record<string, string> = {
      'content-type': result.contentType || 'text/plain; charset=utf-8',
    };
    if (result.xWpTotalPages) headers['x-wp-total-pages'] = result.xWpTotalPages;
    if (result.xWpTotal) headers['x-wp-total'] = result.xWpTotal;
    res.writeHead(200, headers);
    res.end(result.body);
    return;
  }
  sendJson(res, result.status, { error: result.reason });
}

/** The four routes this proxy exists for (design spec §5.7, and the
 * broken-image-detection design): fetching an old-site page's media URLs,
 * checking whether a single resolved image URL actually loads, and
 * forwarding an arbitrary old-site URL's body for the site-import
 * fetchers (/api/fetch). Never the media bytes themselves. Everything else
 * (parsing, SSRF guarding, timeouts, caching) lives in fetchPageMedia.ts/
 * checkImage.ts/fetchUrl.ts/guard.ts/cache.ts; this file is just the HTTP
 * entry point. */
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

    if (requestUrl.pathname === '/api/fetch') {
      if (!target) {
        sendJson(res, 400, { error: 'missing "url" query parameter' });
        return;
      }
      await handleFetch(target, res);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  })();
});

server.listen(PORT, () => {
  console.log(`Relay media proxy listening on http://localhost:${PORT}`);
});

export { server };
