import type { ParseResult } from '../../types/domain';
import type { SiteArticle, SiteFetchFilter, TextFetchLike } from './types';
import { probeSite, normalizeBaseUrl } from './probeSite';
import { fetchRestPosts } from './fetchRestPosts';
import { fetchFeaturedImageUrls } from './fetchRestMedia';
import { fetchRestTaxonomies } from './fetchRestTaxonomies';
import { fetchFeedPosts } from './fetchFeedPosts';
import { mapToParseResult, restPostToSiteArticle, feedItemToSiteArticle } from './mapToParseResult';

export interface FetchSiteProgress {
  stage: 'probe' | 'posts' | 'media';
  fetched: number;
  total: number | null;
}

export type FetchSiteResult =
  | { ok: true; result: ParseResult; source: 'rest' | 'rss'; truncated: boolean }
  | { ok: false; reason: string };

/** The single entry point the Import tab calls: probe for REST (falling
 * back to RSS), paginate the posts, resolve featured images, and produce
 * a ParseResult the rest of Relay can consume unchanged. Never throws:
 * failures past the probe stage are contained here (probeSite already
 * guards itself) and surface as { ok: false, reason }. */
export async function fetchSite(
  baseUrl: string,
  fetchImpl: TextFetchLike,
  onProgress?: (p: FetchSiteProgress) => void,
  filter?: SiteFetchFilter,
): Promise<FetchSiteResult> {
  onProgress?.({ stage: 'probe', fetched: 0, total: null });
  const probe = await probeSite(baseUrl, fetchImpl);
  if (!probe.ok) return { ok: false, reason: probe.reason };

  if (probe.source === 'rest') {
    try {
      const { posts, truncated } = await fetchRestPosts(
        probe.apiBase,
        fetchImpl,
        (p) => onProgress?.({ stage: 'posts', fetched: p.fetched, total: p.totalPages != null ? p.totalPages * 100 : null }),
        filter,
      );
      if (posts.length === 0) {
        return { ok: false, reason: 'No articles found in the date range.' };
      }
      const mediaIds = Array.from(new Set(posts.map((post) => post.featured_media).filter((id) => id > 0)));
      onProgress?.({ stage: 'media', fetched: 0, total: mediaIds.length });
      const featuredByMediaId = await fetchFeaturedImageUrls(probe.apiBase, mediaIds, fetchImpl, (resolved) =>
        onProgress?.({ stage: 'media', fetched: Math.min(resolved, mediaIds.length), total: mediaIds.length }),
      );
      const taxonomyMaps = await fetchRestTaxonomies(probe.apiBase, fetchImpl);
      const articles: SiteArticle[] = posts.map((post) =>
        restPostToSiteArticle(post, featuredByMediaId.get(post.featured_media), taxonomyMaps),
      );
      return {
        ok: true,
        result: mapToParseResult({ baseUrl: normalizeBaseUrl(baseUrl), articles, taxonomyMaps }),
        source: 'rest',
        truncated,
      };
    } catch (err) {
      return { ok: false, reason: `Failed to fetch posts: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  try {
    const { items, truncated } = await fetchFeedPosts(
      probe.feedUrl,
      fetchImpl,
      (fetched) => onProgress?.({ stage: 'posts', fetched, total: null }),
      filter,
    );
    if (items.length === 0) {
      return { ok: false, reason: 'No articles found in the date range.' };
    }
    const articles = items.map(feedItemToSiteArticle);
    return {
      ok: true,
      result: mapToParseResult({ baseUrl: normalizeBaseUrl(baseUrl), articles }),
      source: 'rss',
      truncated,
    };
  } catch (err) {
    return { ok: false, reason: `Failed to fetch the feed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
