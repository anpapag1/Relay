import type { MediaResolution } from '../../types/domain';
import { checkImageUrl, type FetchLike } from './mediaClient';
import { mapWithConcurrency } from '../utils/concurrencyLimit';

const CONCURRENCY = 6;
const ABSOLUTE_URL_RE = /^https?:\/\//i;

interface Candidate {
  ref: string;
  url: string;
  base: MediaResolution;
}

/** Probes every already-resolved (matched-export/matched-live) media URL, AND
 * every "self-resolving" ref — a bare `http(s)://` URL that has NO resolution
 * entry at all — to confirm each actually loads. A ref like this shows up
 * when a reader emits a literal absolute URL straight from `<img src>` and
 * that exact URL (or filename) never matched anything in the WXR's own
 * `<wp:attachment>` list: Stage 1 resolution (`resolveStage1Media`) never
 * creates a `resolved[ref]` entry for it — not `matched-export`, and not even
 * `unresolved` (that outcome only gets set during a full build's live Stage-2
 * scrape, never at import time) — so without this second pass such a ref is
 * invisible to both the pre-existing warnings logic and this feature. The URL
 * itself needs no "resolution": for a literal absolute src, the ref already
 * IS the final URL.
 *
 * `imageSrcRefs` is the set of refs known to actually be image `src` values
 * (see `collectImageSrcRefs`) — deliberately NOT every ref `resolved` might
 * contain. `state.media.resolved` also carries entries for `file` node
 * hrefs (a PDF/doc, matched via the very same Stage-1 attachment lookup) and
 * for an `image`/`gallery` node's `href` (a link destination the image
 * points to, which can be any URL at all, not necessarily an image). HEAD-
 * checking either of those and expecting an `image/*` response would flag a
 * perfectly working PDF or linked page as "broken" — every check, both the
 * already-resolved path and the self-resolving path, is filtered down to
 * `imageSrcRefs` for exactly this reason.
 *
 * Only touches entries with no `verified` yet, and dedupes by URL so an image
 * reused across many articles/refs is checked once. Returns just the updated
 * entries (ref -> MediaResolution with `verified` set), ready to merge via
 * SET_MEDIA_RESOLUTIONS.
 *
 * A check result only counts as a confirmed `'broken'` when it carries a
 * definite `status` — i.e. a real HTTP response was received and it was bad
 * (wrong status code or wrong content-type). When `!check.ok` but
 * `check.status` is `undefined` (guard refusal, network error, timeout, or
 * too-many-redirects with no response ever obtained), that's an unconfirmed
 * / transient failure, not evidence the image is broken: the ref is left out
 * of `updates` entirely so its `verified` field stays unset, avoiding a false
 * "broken" flag and leaving it eligible for a future check attempt. */
export async function verifyResolvedImages(
  resolved: Record<string, MediaResolution>,
  imageSrcRefs: string[],
  fetchImpl: FetchLike,
): Promise<Record<string, MediaResolution>> {
  const imageSrcSet = new Set(imageSrcRefs);
  const candidates: Candidate[] = [];

  for (const [ref, res] of Object.entries(resolved)) {
    if (!imageSrcSet.has(ref)) continue; // never check a file href or a link-destination href as if it were an image
    if ((res.outcome === 'matched-export' || res.outcome === 'matched-live') && res.url && res.verified === undefined) {
      candidates.push({ ref, url: res.url, base: res });
    }
  }

  for (const ref of imageSrcSet) {
    if (resolved[ref]) continue; // already has a resolution (handled above, or a non-matching outcome we don't touch)
    if (!ABSOLUTE_URL_RE.test(ref)) continue; // attachment:N placeholder, relative path — nothing to self-resolve
    candidates.push({ ref, url: ref, base: { outcome: 'matched-export', url: ref } });
  }

  if (candidates.length === 0) return {};

  const uniqueUrls = Array.from(new Set(candidates.map((c) => c.url)));
  const checks = await mapWithConcurrency(uniqueUrls, CONCURRENCY, (url) => checkImageUrl(url, fetchImpl));
  const byUrl = new Map(uniqueUrls.map((url, i) => [url, checks[i]]));

  const updates: Record<string, MediaResolution> = {};
  for (const { ref, url, base } of candidates) {
    const check = byUrl.get(url)!;
    if (!check.ok && check.status === undefined) {
      // Unconfirmed/transient failure (no real response was ever obtained) —
      // don't flag as broken; leave unset so it can be re-checked later.
      continue;
    }
    updates[ref] = {
      ...base,
      verified: check.ok ? 'ok' : 'broken',
      verifiedReason: check.ok ? undefined : check.reason,
    };
  }
  return updates;
}
