import type { MediaResolution } from '../../types/domain';
import { checkImageUrl, type FetchLike } from './mediaClient';
import { mapWithConcurrency } from '../utils/concurrencyLimit';

const CONCURRENCY = 6;

/** Probes every already-resolved (matched-export/matched-live) media URL to
 * confirm it actually loads. Only touches entries with no `verified` yet,
 * and dedupes by URL so an image reused across many articles/refs is
 * checked once. Returns just the updated entries (ref -> MediaResolution
 * with `verified` set), ready to merge via SET_MEDIA_RESOLUTIONS. */
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
    updates[ref] = {
      ...res,
      verified: check.ok ? 'ok' : 'broken',
      verifiedReason: check.ok ? undefined : check.reason,
    };
  }
  return updates;
}
