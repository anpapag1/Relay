import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

export function writeGallery(
  node: Extract<IRNode, { kind: 'gallery' }>,
  settings: ConversionSettings,
): string {
  const images = node.images
    .map((image) => {
      const img = `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.alt)}"/>`;
      return `<!-- wp:image -->\n<figure class="wp-block-image">${img}</figure>\n<!-- /wp:image -->`;
    })
    .join('\n');

  const attrs = JSON.stringify({ columns: settings.galleryCols, linkTo: 'none' });
  return `<!-- wp:gallery ${attrs} -->\n<figure class="wp-block-gallery has-nested-images columns-${settings.galleryCols}">\n${images}\n</figure>\n<!-- /wp:gallery -->`;
}
