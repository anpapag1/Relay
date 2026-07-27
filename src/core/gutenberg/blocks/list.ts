import type { IRNode } from '../../ir/nodes';

export function writeList(node: Extract<IRNode, { kind: 'list' }>): string {
  const tag = node.ordered ? 'ol' : 'ul';
  const attrs = node.ordered ? ' {"ordered":true}' : '';
  const items = node.items.map((item) => `<li>${item}</li>`).join('');
  return `<!-- wp:list${attrs} -->\n<${tag} class="wp-block-list">${items}</${tag}>\n<!-- /wp:list -->`;
}
