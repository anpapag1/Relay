import type { IRNode } from '../../ir/nodes';

export function writeSpacer(node: Extract<IRNode, { kind: 'spacer' }>): string {
  return `<!-- wp:spacer {"height":"${node.height}px"} -->\n<div style="height:${node.height}px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->`;
}
