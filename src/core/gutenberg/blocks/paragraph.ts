import type { IRNode } from '../../ir/nodes';

export function writeParagraph(node: Extract<IRNode, { kind: 'paragraph' }>): string {
  return `<!-- wp:paragraph -->\n<p>${node.html}</p>\n<!-- /wp:paragraph -->`;
}
