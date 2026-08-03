import type { MediaResolution } from '../../types/domain';
import { checkImageUrl, type FetchLike } from './mediaClient';
import { mapWithConcurrency } from '../utils/concurrencyLimit';

const CONCURRENCY = 6;

/** Probes every already-resolved (matched-export/matched-live) media URL to
 * confirm it actually loads. Only touches entries with no `verified` yet,
 * and dedupes by URL so an image reused across many articles/refs is
 * checked once. Returns just the updated entries (ref -> MediaResolution
 * with `verified` set), ready to merge via SET_MEDIA_RESOLUTIONS.
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
  fetchImpl: FetchLike,
): Promise<Record<string, MediaResolution>> {
  const toCheck = Object.entries(resolved).filter(
    ([, res]) =>
      (res.outcome === 'matched-export' || res.outcome === 'matched-live') &&
      res.url &&
      res.verified === undefined,
  );
  if (toCheck.length === 0) return {};

  const uniqueUrls = Array.from(new Set(toCheck.map(([, res]) => res.url as string)));
  const checks = await mapWithConcurrency(uniqueUrls, CONCURRENCY, (url) => checkImageUrl(url, fetchImpl));
  const byUrl = new Map(uniqueUrls.map((url, i) => [url, checks[i]]));

  const updates: Record<string, MediaResolution> = {};
  for (const [ref, res] of toCheck) {
    const check = byUrl.get(res.url as string)!;
    if (!check.ok && check.status === undefined) {
      // Unconfirmed/transient failure (no real response was ever obtained) —
      // don't flag as broken; leave unset so it can be re-checked later.
      continue;
    }
    updates[ref] = {
      ...res,
      verified: check.ok ? 'ok' : 'broken',
      verifiedReason: check.ok ? undefined : check.reason,
    };
  }
  return updates;
}
