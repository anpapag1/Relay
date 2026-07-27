import type { BuilderReader, DetectInput } from '../types';
import { readPlainHtml } from './read';

/** The fallback reader: scores low but non-zero whenever content has any
 * markup, so it always wins when nothing more specific matches. */
function detect(input: DetectInput): number {
  return input.contentHtml.trim().length > 0 ? 0.2 : 0;
}

export const plainHtmlReader: BuilderReader = {
  id: 'plainHtml',
  detect,
  read: readPlainHtml,
};
