import type { IRNode } from '../../ir/nodes';

export function writeQuote(node: Extract<IRNode, { kind: 'quote' }>): string {
  const cite = node.cite ? `<cite>${node.cite}</cite>` : '';
  return `<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${node.html}</p>${cite}</blockquote>\n<!-- /wp:quote -->`;
}
