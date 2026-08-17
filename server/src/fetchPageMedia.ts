import { guardUrl } from './guard';
import { requestOnce, TimeoutError, absolutize, type RawResponse } from './rawRequest';

export interface PageMediaResult {
  ogImage: string | null;
  images: string[];
  files: string[];
}

export type FetchPageMediaResult =
  | { status: 200; body: PageMediaResult }
  | { status: 400; reason: string }
  | { status: 502; reason: string }
  | { status: 504; reason: string };

export interface FetchPageMediaOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 2;

const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["']/gi;
const ANCHOR_HREF_RE = /<a[^>]+href=["']([^"']+)["']/gi;
const FILE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt)(\?.*)?$/i;

function extractPageMedia(html: string, pageUrl: string): PageMediaResult {
  const ogMatch = OG_IMAGE_RE.exec(html);
  const ogImage = ogMatch ? absolutize(ogMatch[1], pageUrl) : null;

  const images = new Set<string>();
  IMG_SRC_RE.lastIndex = 0;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = IMG_SRC_RE.exec(html)) !== null) {
    const absolute = absolutize(imgMatch[1], pageUrl);
    if (absolute) images.add(absolute);
  }

  const files = new Set<string>();
  ANCHOR_HREF_RE.lastIndex = 0;
  let anchorMatch: RegExpExecArray | null;
  while ((anchorMatch = ANCHOR_HREF_RE.exec(html)) !== null) {
    if (!FILE_EXT_RE.test(anchorMatch[1])) continue;
    const absolute = absolutize(anchorMatch[1], pageUrl);
    if (absolute) files.add(absolute);
  }

  return { ogImage, images: Array.from(images), files: Array.from(files) };
}

/** Fetches one old-site page and returns the media URLs discovered on it
 * — never the bytes of the media itself (design spec §5.7/§10): the
 * generated WXR references original URLs, and the WordPress importer is
 * what downloads them. Every hop (the initial URL and each redirect
 * target) is re-checked by guardUrl before connecting, so a redirect
 * can't be used to reach a private/loopback/link-local address the
 * initial URL would have been refused for directly. */
export async function fetchPageMedia(targetUrl: string, options: FetchPageMediaOptions): Promise<FetchPageMediaResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = targetUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const guard = await guardUrl(currentUrl);
    if (!guard.ok) return { status: 400, reason: guard.reason };

    let response: RawResponse;
    try {
      response = await requestOnce(new URL(currentUrl), timeoutMs, maxBytes);
    } catch (err) {
      if (err instanceof TimeoutError) return { status: 504, reason: 'the old site did not respond in time' };
      return { status: 502, reason: err instanceof Error ? err.message : 'request to the old site failed' };
    }

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location;
      if (!location) return { status: 502, reason: `redirect with no Location header (status ${response.statusCode})` };
      if (hop === maxRedirects) return { status: 502, reason: 'too many redirects' };
      const resolved = absolutize(location, currentUrl);
      if (!resolved) return { status: 502, reason: 'redirect target was not a valid URL' };
      currentUrl = resolved;
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { status: 502, reason: `the old site responded with status ${response.statusCode}` };
    }

    const contentType = response.headers['content-type'] ?? '';
    if (!contentType.includes('text/html')) {
      return { status: 502, reason: `unexpected content-type: ${contentType || '(none)'}` };
    }

    const html = response.body.toString('utf-8');
    return { status: 200, body: extractPageMedia(html, currentUrl) };
  }

  return { status: 502, reason: 'too many redirects' };
}
