import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Resolves the emitted width/height: an explicit custom size scales the
 * other dimension proportionally when only one is set; otherwise the
 * writer defers to sizeSlug and the image's own intrinsic dimensions.
 * Exported so the gallery writer can size its nested images the same way. */
export function resolveImageDimensions(
  image: { width?: number; height?: number },
  settings: ConversionSettings,
): { width?: number; height?: number } {
  if (settings.imageSize !== 'custom') {
    return { width: image.width, height: image.height };
  }
  const { customWidth, customHeight } = settings;
  if (customWidth && !customHeight && image.width && image.height) {
    return { width: customWidth, height: Math.round((customWidth * image.height) / image.width) };
  }
  if (customHeight && !customWidth && image.width && image.height) {
    return { height: customHeight, width: Math.round((customHeight * image.width) / image.height) };
  }
  return { width: customWidth ?? image.width, height: customHeight ?? image.height };
}

export function writeImage(
  node: Extract<IRNode, { kind: 'image' }>,
  settings: ConversionSettings,
): string {
  const attrs: Record<string, unknown> = {};
  if (settings.imageAlign !== 'none') attrs.align = settings.imageAlign;
  if (settings.imageSize !== 'custom') attrs.sizeSlug = settings.imageSize;

  const { width, height } = resolveImageDimensions(node, settings);
  const dimAttrs = `${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}`;
  const img = `<img src="${escapeAttr(node.src)}" alt="${escapeAttr(node.alt)}"${dimAttrs}/>`;
  const linked = node.href ? `<a href="${escapeAttr(node.href)}">${img}</a>` : img;
  const figcaption = node.caption
    ? `<figcaption class="wp-element-caption">${node.caption}</figcaption>`
    : '';

  const classes = ['wp-block-image'];
  if (settings.imageAlign !== 'none') classes.push(`align${capitalize(settings.imageAlign)}`);
  if (settings.imageSize !== 'custom') classes.push(`size-${settings.imageSize}`);

  // A floated (left/right-aligned) image butts straight up against
  // wrapped text with no theme CSS guaranteeing a gap — autoSpacing adds
  // one explicitly, on the side the text wraps against.
  let style = '';
  if (settings.autoSpacing && settings.imageAlign === 'left') style = ` style="margin-right:${settings.spacerSize}px"`;
  else if (settings.autoSpacing && settings.imageAlign === 'right') style = ` style="margin-left:${settings.spacerSize}px"`;

  return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="${classes.join(' ')}"${style}>${linked}${figcaption}</figure>\n<!-- /wp:image -->`;
}
