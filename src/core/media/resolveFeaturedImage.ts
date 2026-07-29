import type { MediaResolution, PostMeta } from '../../types/domain';
import { matchAttachment, type AttachmentIndex } from './attachmentIndex';
import { fetchPageMedia, type FetchLike } from './mediaClient';

/** Resolves an article's featured image. Gated on the old post's own
 * `_thumbnail_id` postmeta having been set — if the old site never
 * assigned a featured image, this returns `null` rather than falling
 * through to a scraped `og:image`, which on many sites falls back to a
 * site-wide logo or default share image that isn't the article's own
 * (see design spec: featured image gating). Stage 1 matches the id
 * against the export's own attachment index (no network); stage 2, only
 * reached when stage 1 misses and the article has a known URL, scrapes
 * the live old-site page for its `og:image` meta tag — deliberately not
 * a filename/URL match against inline page images, since an attachment
 * id carries no filename to match against. */
export async function resolveFeaturedImage(
  postmeta: PostMeta,
  index: AttachmentIndex,
  articleUrl: string | null,
  fetchImpl: FetchLike,
): Promise<MediaResolution | null> {
  const thumbnailId = postmeta._thumbnail_id;
  if (!thumbnailId) return null;

  const matched = matchAttachment(index, `attachment:${thumbnailId}`);
  if (matched) return { outcome: 'matched-export', url: matched };

  if (!articleUrl) {
    return { outcome: 'unresolved', reason: 'Not in the export, and the article has no known URL to scrape.' };
  }

  const pageMedia = await fetchPageMedia(articleUrl, fetchImpl);
  if (!pageMedia.ok) {
    const reason =
      pageMedia.reason === 'refused'
        ? 'The media proxy refused to fetch this URL.'
        : 'The old site could not be reached.';
    return { outcome: 'unreachable', reason };
  }

  if (pageMedia.media.ogImage) {
    return { outcome: 'matched-live', url: pageMedia.media.ogImage };
  }

  return {
    outcome: 'unresolved',
    reason: 'This article had a featured image on the old site, but it could not be found in the export or on the live page.',
  };
}
