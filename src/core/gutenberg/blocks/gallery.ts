import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

/** Gallery images always link to the WordPress core lightbox and never
 * carry per-image id/sizeSlug/width/height — unlike a standalone image,
 * a gallery photo is meant to be clicked open at full size rather than
 * pinned to one export-time size, so baking in a size or attachment id
 * would just go stale the moment the media library changes. */
export function writeGallery(
  node: Extract<IRNode, { kind: 'gallery' }>,
  settings: ConversionSettings,
): string {
  const columns = settings.galleryColumns;

  const images = node.images
    .map((image) => {
      const img = `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.alt)}"/>`;
      const attrs = { lightbox: { enabled: true }, linkDestination: 'none' };
      return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="wp-block-image">${img}</figure>\n<!-- /wp:image -->`;
    })
    .join('\n\n');

  return `<!-- wp:gallery {"columns":${columns},"linkTo":"lightbox"} -->\n<figure class="wp-block-gallery has-nested-images columns-${columns} is-cropped">\n${images}\n</figure>\n<!-- /wp:gallery -->`;
}
