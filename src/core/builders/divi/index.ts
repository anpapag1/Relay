import type { BuilderReader, DetectInput } from '../types';
import { readDivi } from './read';

function detect(input: DetectInput): number {
  const hasSection = /\[et_pb_section\b/.test(input.contentHtml);
  const hasRow = /\[et_pb_row\b/.test(input.contentHtml);
  const hasAny = /\[et_pb_[a-z_]+/.test(input.contentHtml);
  if (hasSection && hasRow) return 0.95;
  if (hasAny) return 0.6;
  return 0;
}

export const diviReader: BuilderReader = {
  id: 'divi',
  detect,
  read: readDivi,
};
