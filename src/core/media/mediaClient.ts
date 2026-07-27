export interface PageMediaResult {
  ogImage: string | null;
  images: string[];
  files: string[];
}

/** A fetch-like function, injected rather than reaching for the global —
 * this is the one function in core/ that touches the network, and taking
 * it as a parameter keeps it testable with a stub and keeps every other
 * core module pure. */
export type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export type PageMediaFetchResult =
  | { ok: true; media: PageMediaResult }
  | { ok: false; reason: 'unreachable' | 'refused' };

function isPageMediaResult(value: unknown): value is PageMediaResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.ogImage === null || typeof candidate.ogImage === 'string') &&
    Array.isArray(candidate.images) &&
    Array.isArray(candidate.files)
  );
}

/** Calls the media proxy's single route (server/index.ts, Task #9) for
 * the given old-site article URL. Never throws: a network failure, a
 * non-2xx response, or a malformed body all come back as a typed
 * `{ok:false}` result so callers can distinguish "the proxy refused this
 * URL" (400, guard.ts) from "the old site could not be reached" (502/504
 * or a thrown fetch error) without wrapping every call site in try/catch. */
export async function fetchPageMedia(articleUrl: string, fetchImpl: FetchLike): Promise<PageMediaFetchResult> {
  try {
    const response = await fetchImpl(`/api/page-media?url=${encodeURIComponent(articleUrl)}`);
    if (response.status === 400) return { ok: false, reason: 'refused' };
    if (!response.ok) return { ok: false, reason: 'unreachable' };
    const body = await response.json();
    if (!isPageMediaResult(body)) return { ok: false, reason: 'unreachable' };
    return { ok: true, media: body };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}
