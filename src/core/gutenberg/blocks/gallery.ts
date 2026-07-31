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
  const ratio = settings.galleryAspectRatio;
  const cropped = ratio !== 'none';

  const galleryAttrs: Record<string, unknown> = { columns, linkTo: 'lightbox' };
  if (cropped) galleryAttrs.aspectRatio = ratio;

  const images = node.images
    .map((image, index) => {
      const style = cropped ? ` style="aspect-ratio:${ratio}"` : '';
      const img = `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.alt)}"${style}/>`;
      const attrs: Record<string, unknown> = { lightbox: { enabled: true } };
      if (cropped) attrs.aspectRatio = ratio;
      attrs.linkDestination = 'none';
      // A real WordPress editor only stamps the "is-style-default" style
      // class (and its matching className attr) onto the gallery's first
      // image block when a crop ratio is applied to the whole gallery —
      // every image after it stays unclassed. Reproduced exactly, quirk
      // and all, rather than "fixed" into applying to every image.
      const isFirstCropped = cropped && index === 0;
      if (isFirstCropped) attrs.className = 'is-style-default';
      const figureClass = isFirstCropped ? 'wp-block-image is-style-default' : 'wp-block-image';
      return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="${figureClass}">${img}</figure>\n<!-- /wp:image -->`;
    })
    .join('\n\n');

  return `<!-- wp:gallery ${JSON.stringify(galleryAttrs)} -->\n<figure class="wp-block-gallery has-nested-images columns-${columns} is-cropped">\n${images}\n</figure>\n<!-- /wp:gallery -->`;
}
