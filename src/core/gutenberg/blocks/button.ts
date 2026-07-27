import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

function linkAttrs(settings: ConversionSettings): string {
  return settings.linksNewTab ? ' target="_blank" rel="noreferrer noopener"' : '';
}

export function writeButton(
  node: Extract<IRNode, { kind: 'button' }>,
  settings: ConversionSettings,
): string {
  const target = linkAttrs(settings);
  const href = escapeAttr(node.href);

  if (settings.buttonRender === 'link') {
    return `<!-- wp:paragraph -->\n<p><a href="${href}"${target}>${node.text}</a></p>\n<!-- /wp:paragraph -->`;
  }

  return `<!-- wp:buttons -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${href}"${target}>${node.text}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`;
}
