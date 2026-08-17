import { guardUrl } from './guard';
import { requestOnce, TimeoutError } from './rawRequest';

export interface FetchUrlOk {
  status: 200;
  body: string;
  contentType: string;
  /** Upstream WordPress pagination headers, forwarded so the same-origin
   * client can read them off the proxied response (fetchRestPosts.ts). */
  xWpTotalPages?: string;
  xWpTotal?: string;
}
export type FetchUrlResult = FetchUrlOk | { status: 400; reason: string } | { status: 502; reason: string } | { status: 504; reason: string };

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 2;

function absolutize(url: string, base: string): string | null {
  try { return new URL(url, base).toString(); } catch { return null; }
}

export async function fetchUrl(targetUrl: string, options: { timeoutMs?: number; maxBytes?: number } = {}): Promise<FetchUrlResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= DEFAULT_MAX_REDIRECTS; hop += 1) {
    const guard = await guardUrl(currentUrl);
    if (!guard.ok) return { status: 400, reason: guard.reason };

    let response;
    try {
      response = await requestOnce(new URL(currentUrl), timeoutMs, maxBytes);
    } catch (err) {
      if (err instanceof TimeoutError) return { status: 504, reason: 'the old site did not respond in time' };
      return { status: 502, reason: err instanceof Error ? err.message : 'request to the old site failed' };
    }

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location;
      if (!location) return { status: 502, reason: `redirect with no Location header (status ${response.statusCode})` };
      if (hop === DEFAULT_MAX_REDIRECTS) return { status: 502, reason: 'too many redirects' };
      const resolved = absolutize(location, currentUrl);
      if (!resolved) return { status: 502, reason: 'redirect target was not a valid URL' };
      currentUrl = resolved;
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { status: 502, reason: `the old site responded with status ${response.statusCode}` };
    }

    return {
      status: 200,
      body: response.body.toString('utf-8'),
      contentType: response.headers['content-type'] ?? '',
      xWpTotalPages:
        typeof response.headers['x-wp-total-pages'] === 'string'
          ? response.headers['x-wp-total-pages']
          : undefined,
      xWpTotal: typeof response.headers['x-wp-total'] === 'string' ? response.headers['x-wp-total'] : undefined,
    };
  }

  return { status: 502, reason: 'too many redirects' };
}
