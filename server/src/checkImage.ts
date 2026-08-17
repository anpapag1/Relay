import http from 'node:http';
import https from 'node:https';
import { guardUrl } from './guard';
import { absolutize } from './rawRequest';

export interface CheckImageResult {
  ok: boolean;
  status?: number;
  reason?: string;
}

export interface CheckImageOptions {
  timeoutMs?: number;
  maxRedirects?: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 2;

class TimeoutError extends Error {}

function headOnce(url: URL, timeoutMs: number): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: 'HEAD', headers: { 'User-Agent': 'RelayMediaProxy/1.0' } }, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode ?? 0, headers: res.headers });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new TimeoutError('request timed out'));
    });
    req.end();
  });
}

/** Checks whether an already-resolved image URL actually loads, via HEAD
 * request through the SSRF guard — closing the gap where a media reference
 * can string-match successfully (attachment index or live-page scrape) and
 * still 404 in practice, undetected until a user opens the article. Never
 * fetches the image bytes (HEAD only). Every hop (initial URL and each
 * redirect target) is re-guarded, same rationale as fetchPageMedia.ts. */
export async function checkImage(targetUrl: string, options: CheckImageOptions = {}): Promise<CheckImageResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const guard = await guardUrl(currentUrl);
    if (!guard.ok) return { ok: false, reason: guard.reason };

    let response: { statusCode: number; headers: http.IncomingHttpHeaders };
    try {
      response = await headOnce(new URL(currentUrl), timeoutMs);
    } catch (err) {
      if (err instanceof TimeoutError) return { ok: false, reason: 'the old site did not respond in time' };
      return { ok: false, reason: err instanceof Error ? err.message : 'request to the old site failed' };
    }

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location;
      if (!location) return { ok: false, status: response.statusCode, reason: 'redirect with no Location header' };
      if (hop === maxRedirects) return { ok: false, reason: 'too many redirects' };
      const resolved = absolutize(location, currentUrl);
      if (!resolved) return { ok: false, reason: 'redirect target was not a valid URL' };
      currentUrl = resolved;
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { ok: false, status: response.statusCode, reason: `the old site responded with status ${response.statusCode}` };
    }

    const contentType = response.headers['content-type'] ?? '';
    if (!contentType.startsWith('image/')) {
      return { ok: false, status: response.statusCode, reason: `unexpected content-type: ${contentType || '(none)'}` };
    }

    return { ok: true, status: response.statusCode };
  }

  return { ok: false, reason: 'too many redirects' };
}
