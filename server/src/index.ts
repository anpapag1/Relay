import http from 'node:http';
import { fetchPageMedia, type PageMediaResult } from './fetchPageMedia';
import { getCached, setCached } from './cache';

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_HOSTS = new Set(
  (process.env.RELAY_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
);

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** The single route this proxy exists for (design spec §5.7): fetches an
 * old-site page and returns the media URLs found on it — never the media
 * bytes themselves. Everything else (parsing, SSRF guarding, timeouts,
 * caching) lives in fetchPageMedia.ts/guard.ts/cache.ts; this file is
 * just the HTTP entry point. */
const server = http.createServer((req, res) => {
  void (async () => {
    if (req.method !== 'GET' || !req.url) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    if (requestUrl.pathname !== '/api/page-media') {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    const target = requestUrl.searchParams.get('url');
    if (!target) {
      sendJson(res, 400, { error: 'missing "url" query parameter' });
      return;
    }

    const cached = getCached<PageMediaResult>(target);
    if (cached) {
      sendJson(res, 200, cached);
      return;
    }

    const result = await fetchPageMedia(target, { allowedHosts: ALLOWED_HOSTS });
    if (result.status === 200) {
      setCached(target, result.body);
      sendJson(res, 200, result.body);
    } else {
      sendJson(res, result.status, { error: result.reason });
    }
  })();
});

server.listen(PORT, () => {
  const hostList = ALLOWED_HOSTS.size > 0 ? Array.from(ALLOWED_HOSTS).join(', ') : '(none — set RELAY_ALLOWED_HOSTS)';
  console.log(`Relay media proxy listening on http://localhost:${PORT}`);
  console.log(`Allowed hosts: ${hostList}`);
});
