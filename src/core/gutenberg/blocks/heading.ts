import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';

/** headingShift demotes h1..h6 by N, clamped so it never escapes the
 * h1-h6 range in either direction. */
export function writeHeading(
  node: Extract<IRNode, { kind: 'heading' }>,
  settings: ConversionSettings,
): string {
  const level = Math.min(6, Math.max(1, node.level + settings.headingShift));
  return `<!-- wp:heading {"level":${level}} -->\n<h${level} class="wp-block-heading">${node.html}</h${level}>\n<!-- /wp:heading -->`;
}
