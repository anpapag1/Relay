import type { IRNode } from '../../ir/nodes';

/** node.note is a warning surfaced on the article, never emitted into the
 * block markup itself. */
export function writeRaw(node: Extract<IRNode, { kind: 'raw' }>): string {
  return `<!-- wp:html -->\n${node.html}\n<!-- /wp:html -->`;
}
