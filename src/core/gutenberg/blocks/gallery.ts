import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';
import { resolveImageDimensions } from './image';

/** Matches WordPress's own default gallery block markup (no explicit
 * column count — `columns-default` lets the block's own responsive CSS
 * decide) rather than a fixed per-migration column setting. */
export function writeGallery(
  node: Extract<IRNode, { kind: 'gallery' }>,
  settings: ConversionSettings,
): string {
  const sizeSlug = settings.imageSize !== 'custom' ? settings.imageSize : undefined;

  const images = node.images
    .map((image) => {
      const { width, height } = resolveImageDimensions(image, settings);
      const dimAttrs = `${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}`;
      const imgClass = image.attachmentId ? ` class="wp-image-${image.attachmentId}"` : '';
      const img = `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.alt)}"${imgClass}${dimAttrs}/>`;
      const attrs: Record<string, unknown> = {};
      if (image.attachmentId) attrs.id = image.attachmentId;
      if (sizeSlug) attrs.sizeSlug = sizeSlug;
      attrs.linkDestination = 'none';
      const classes = ['wp-block-image', ...(sizeSlug ? [`size-${sizeSlug}`] : [])];
      return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="${classes.join(' ')}">${img}</figure>\n<!-- /wp:image -->`;
    })
    .join('\n\n');

  return `<!-- wp:gallery {"linkTo":"none"} -->\n<figure class="wp-block-gallery has-nested-images columns-default is-cropped">\n${images}\n</figure>\n<!-- /wp:gallery -->`;
}
