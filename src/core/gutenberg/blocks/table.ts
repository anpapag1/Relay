import type { IRNode } from '../../ir/nodes';

/** Gutenberg's table block is just the original <table> wrapped in a
 * figure — no restructuring needed, so nothing new can go wrong beyond
 * what was already in the source table (an exotic colspan/rowspan still
 * passes through inside the table exactly as before). */
export function writeTable(node: Extract<IRNode, { kind: 'table' }>): string {
  return `<!-- wp:table -->\n<figure class="wp-block-table">${node.html}</figure>\n<!-- /wp:table -->`;
}
