import type { BuilderId, BuilderReader } from './types';
import { plainHtmlReader } from './plainHtml';
import { wpbakeryReader } from './wpbakery';
import { elementorReader } from './elementor';
import { diviReader } from './divi';

/** Adding a builder is a new folder plus one line here — see
 * docs/adding-a-builder.md. */
export const builderReaders: Record<BuilderId, BuilderReader> = {
  plainHtml: plainHtmlReader,
  wpbakery: wpbakeryReader,
  elementor: elementorReader,
  divi: diviReader,
};

export function getReader(id: BuilderId): BuilderReader {
  return builderReaders[id];
}

export type { BuilderId, BuilderReader, DetectInput, ReadInput, ReadResult } from './types';
