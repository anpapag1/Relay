import { filenameOf } from './attachmentIndex';

/** Synthetic attachment ids start well above any real wp:post_id a WXR
 * export would plausibly contain, so they can never collide with one. */
const SYNTHETIC_ATTACHMENT_ID_BASE = 900_000_000;

export interface AttachmentRegistryEntry {
  id: number;
  filename: string;
}

export type AttachmentRegistry = Map<string, AttachmentRegistryEntry>;

/** Dedupes a flat list of media URLs — featured images and inline content
 * images/galleries alike — by URL: one synthetic attachment per unique
 * image, not one per article or per reference, so sites where many posts
 * share an image (a series, a default social-share image, etc.) don't
 * balloon the export with duplicates. Built once per build/export (shared
 * between runBuild, which embeds these ids into each image block's
 * `id`/`wp-image-<id>` the way a real WordPress-authored image carries
 * one, and generateWxr, which emits the matching synthetic `<wp:attachment>`
 * item) so both always agree on the same id for the same URL. */
export function buildAttachmentRegistry(urls: Iterable<string | null | undefined>): AttachmentRegistry {
  const registry: AttachmentRegistry = new Map();
  let nextId = SYNTHETIC_ATTACHMENT_ID_BASE;

  for (const url of urls) {
    if (!url || registry.has(url)) continue;
    registry.set(url, { id: nextId, filename: filenameOf(url) });
    nextId += 1;
  }

  return registry;
}
