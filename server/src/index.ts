import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fetchPageMedia, type PageMediaResult } from './fetchPageMedia.js';
import { checkImage, type CheckImageResult } from './checkImage.js';
import { fetchUrl } from './fetchUrl.js';
import { getCached, setCached } from './cache.js';
import { log } from './log.js';

const PORT = Number(process.env.PORT ?? 8787);

/** Directory that holds the built SPA (Vite `dist`). In the container the
 * runtime stage copies the frontend build here and the proxy serves both
 * the API routes and the static app from one process/origin. */
const STATIC_DIR = process.env.STATIC_DIR ?? 'dist';

/** A 100-post REST page with rendered content can exceed the 3MB default,
 * so /api/fetch (unlike /api/page-media and /api/image-check) raises its
 * own body cap. */
const FETCH_MAX_BYTES = 16 * 1024 * 1024;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

/** Serves the built SPA from STATIC_DIR so the proxy can also host the
 * frontend on the same origin (no CORS, one container). Any path outside
 * /api falls through here; unknown paths get index.html (SPA client
 * routing), traversal attempts and API misspells get a 404. */
async function serveStatic(requestUrl: URL, rawPath: string, res: http.ServerResponse): Promise<void> {
  if (requestUrl.pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  // Reject dot-segment traversal on the raw request target. The WHATWG URL
  // parser already collapses %2e%2e/../ segments before routing, so check
  // pre-normalization to keep a clean 404 for attack-shaped paths.
  if (/(^|\/)\.{1,2}(\/|%2f)/i.test(rawPath) || /%2e%2e/i.test(rawPath)) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  const base = path.resolve(STATIC_DIR);
  let pathname: string;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendJson(res, 400, { error: 'bad request' });
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = path.resolve(base, '.' + pathname);

  if (filePath !== base && !filePath.startsWith(base + path.sep)) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    });
    res.end(content);
  } catch {
    try {
      const index = await readFile(path.join(base, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(index);
    } catch {
      sendJson(res, 404, { error: 'not found' });
    }
  }
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
    log.warn('proxy_failed', { route: '/api/page-media', target, status: result.status, reason: result.reason });
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
  if (!result.ok) {
    log.warn('proxy_failed', { route: '/api/image-check', target, status: result.status, reason: result.reason });
  }
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
    if (result.xWpTotalPages) headers['x-wp-totalpages'] = result.xWpTotalPages;
    if (result.xWpTotal) headers['x-wp-total'] = result.xWpTotal;
    res.writeHead(200, headers);
    res.end(result.body);
    return;
  }
  log.warn('proxy_failed', { route: '/api/fetch', target, status: result.status, reason: result.reason });
  sendJson(res, result.status, { error: result.reason });
}

/** The four routes this proxy exists for (design spec §5.7, and the
 * broken-image-detection design): fetching an old-site page's media URLs,
 * checking whether a single resolved image URL actually loads, and
 * forwarding an arbitrary old-site URL's body for the site-import
 * fetchers (/api/fetch). Never the media bytes themselves. Everything else
 * (parsing, SSRF guarding, timeouts, caching) lives in fetchPageMedia.ts/
 * checkImage.ts/fetchUrl.ts/guard.ts/cache.ts; this file is just the HTTP
 * entry point. /health is a liveness probe for container orchestrators. */
const server = http.createServer((req, res) => {
  const startedAt = Date.now();

  void (async () => {
    try {
      if (req.method !== 'GET' || !req.url) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }

      const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
      const target = requestUrl.searchParams.get('url');

      if (requestUrl.pathname === '/health') {
        sendJson(res, 200, { status: 'ok', uptime: Math.round(process.uptime()) });
        return;
      }

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

      await serveStatic(requestUrl, req.url ?? '', res);
    } catch (err) {
      log.error('handler_error', { path: req.url ?? '', error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'internal error' });
      } else {
        res.end();
      }
    }
  })();

  res.on('finish', () => {
    log.info('request', {
      method: req.method ?? '',
      path: req.url ?? '',
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
});

server.listen(PORT, () => {
  log.info('listening', { port: PORT, staticDir: STATIC_DIR });
});

export { server };
