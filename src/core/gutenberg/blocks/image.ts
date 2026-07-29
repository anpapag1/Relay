import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

/** Resolves the emitted width/height: an explicit custom size scales the
 * other dimension proportionally when only one is set; otherwise the
 * writer defers to sizeSlug and the image's own intrinsic dimensions.
 * Exported so the gallery writer can size its nested images the same way.
 * Note this is NOT used for a single image's own custom-size rendering
 * (see `customSizeStyle` in writeImage) — a real WordPress "resized"
 * image lets CSS handle the unset dimension via `auto` rather than a
 * computed proportional pixel value; this proportional version stays the
 * right choice for gallery images, which never go through that same
 * resize UI. */
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

/** A custom-sized single image renders the way WordPress's own "resize"
 * handles do: the unset dimension becomes literal `auto` (letting the
 * browser preserve aspect ratio via CSS) rather than a computed pixel
 * value, expressed as inline style rather than width/height HTML
 * attributes, with an `is-resized` class marking it as such. */
function customSizeStyle(settings: ConversionSettings): { width: string; height: string } {
  return {
    width: settings.customWidth ? `${settings.customWidth}px` : 'auto',
    height: settings.customHeight ? `${settings.customHeight}px` : 'auto',
  };
}

export function writeImage(
  node: Extract<IRNode, { kind: 'image' }>,
  settings: ConversionSettings,
): string {
  const isCustomSize = settings.imageSize === 'custom';
  const attrs: Record<string, unknown> = {};
  if (node.attachmentId) attrs.id = node.attachmentId;

  let dimAttrs = '';
  let imgStyle = '';
  if (isCustomSize) {
    const { width, height } = customSizeStyle(settings);
    attrs.width = width;
    attrs.height = height;
    imgStyle = ` style="width:${width};height:${height}"`;
  } else {
    const { width, height } = resolveImageDimensions(node, settings);
    dimAttrs = `${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}`;
    attrs.sizeSlug = settings.imageSize;
  }

  if (settings.imageAlign !== 'none') attrs.align = settings.imageAlign;

  const imgClass = node.attachmentId ? ` class="wp-image-${node.attachmentId}"` : '';
  const img = `<img src="${escapeAttr(node.src)}" alt="${escapeAttr(node.alt)}"${imgClass}${dimAttrs}${imgStyle}/>`;
  const linked = node.href ? `<a href="${escapeAttr(node.href)}">${img}</a>` : img;
  const figcaption = node.caption
    ? `<figcaption class="wp-element-caption">${node.caption}</figcaption>`
    : '';

  const classes = ['wp-block-image'];
  if (settings.imageAlign !== 'none') classes.push(`align${settings.imageAlign}`);
  if (isCustomSize) classes.push('is-resized');
  else classes.push(`size-${settings.imageSize}`);

  // A floated (left/right-aligned) image butts straight up against
  // wrapped text with no theme CSS guaranteeing a gap — autoSpacing adds
  // one explicitly, on the side the text wraps against.
  let figureStyle = '';
  if (settings.autoSpacing && settings.imageAlign === 'left') figureStyle = ` style="margin-right:${settings.spacerSize}px"`;
  else if (settings.autoSpacing && settings.imageAlign === 'right') figureStyle = ` style="margin-left:${settings.spacerSize}px"`;

  return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="${classes.join(' ')}"${figureStyle}>${linked}${figcaption}</figure>\n<!-- /wp:image -->`;
}
