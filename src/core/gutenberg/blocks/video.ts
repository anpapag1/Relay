import type { IRNode } from '../../ir/nodes';
import { escapeAttr } from '../escapeHtml';

export function writeVideo(node: Extract<IRNode, { kind: 'video' }>): string {
  if (node.provider === 'file') {
    return `<!-- wp:video -->\n<figure class="wp-block-video"><video controls src="${escapeAttr(node.src)}"></video></figure>\n<!-- /wp:video -->`;
  }
  return `<!-- wp:embed {"url":"${escapeAttr(node.src)}","type":"video","providerNameSlug":"${node.provider}"} -->\n<figure class="wp-block-embed is-type-video is-provider-${node.provider}"><div class="wp-block-embed__wrapper">${node.src}</div></figure>\n<!-- /wp:embed -->`;
}
