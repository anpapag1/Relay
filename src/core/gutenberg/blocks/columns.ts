import type { IRNode } from '../../ir/nodes';

/** Takes the top-level writeBlocks function as a parameter, rather than
 * importing it directly, so this file (imported BY writeBlocks.ts) never
 * forms an import cycle with it. */
export function writeColumns(
  node: Extract<IRNode, { kind: 'columns' }>,
  writeInner: (nodes: IRNode[]) => string,
): string {
  const columns = node.columns
    .map((columnNodes) => `<!-- wp:column -->\n<div class="wp-block-column">${writeInner(columnNodes)}</div>\n<!-- /wp:column -->`)
    .join('\n');
  return `<!-- wp:columns -->\n<div class="wp-block-columns">\n${columns}\n</div>\n<!-- /wp:columns -->`;
}
