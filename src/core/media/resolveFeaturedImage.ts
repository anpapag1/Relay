import type { ParsedAttachment } from '../../types/domain';
import { buildAttachmentIndex, matchAttachment } from './attachmentIndex';
import { fetchPageMedia, type FetchLike } from './mediaClient';

export interface ResolveFeaturedImageOptions {
  liveFetchEnabled: boolean;
  fetchImpl: FetchLike;
}

/** WordPress stores an article's featured image as a `_thumbnail_id`
 * postmeta value (an attachment post ID), not inline in contentHtml.
 * Resolved in two stages, same precedence as inline media refs: first
 * against this export's own <wp:attachment> items (matchAttachment); if
 * the export has none (common — WXR exports frequently omit attachment
 * items entirely), falls back to scraping the live old-site article page
 * for its `og:image` meta tag, the same server-side proxy inline media
 * live-fetch already uses. Returns null rather than a fabricated URL when
 * neither source has an answer, or when live fetch is disabled/fails. */
export async function resolveFeaturedImage(
  article: { postmeta: Record<string, string>; link: string | null },
  attachments: ParsedAttachment[],
  options: ResolveFeaturedImageOptions,
): Promise<string | null> {
  const thumbnailId = article.postmeta['_thumbnail_id'];
  if (!thumbnailId) return null;

  const index = buildAttachmentIndex(attachments);
  const fromExport = matchAttachment(index, `attachment:${thumbnailId}`);
  if (fromExport) return fromExport;

  if (!options.liveFetchEnabled || !article.link) return null;

  const result = await fetchPageMedia(article.link, options.fetchImpl);
  if (result.ok && result.media.ogImage) return result.media.ogImage;
  return null;
}
