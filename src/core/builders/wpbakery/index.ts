import type { BuilderReader, DetectInput } from '../types';
import { readWpbakery } from './read';

function detect(input: DetectInput): number {
  const hasRow = /\[vc_row\b/.test(input.contentHtml);
  const hasColumn = /\[vc_column\b/.test(input.contentHtml);
  const hasAnyVc = /\[vc_[a-z_]+/.test(input.contentHtml);
  if (hasRow && hasColumn) return 0.95;
  if (hasAnyVc) return 0.6;
  return 0;
}

export const wpbakeryReader: BuilderReader = {
  id: 'wpbakery',
  detect,
  read: readWpbakery,
};
