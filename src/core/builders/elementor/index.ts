import type { BuilderReader, DetectInput } from '../types';
import { readElementor } from './read';

function detect(input: DetectInput): number {
  if (input.postmeta['_elementor_data']) return 0.95;
  if (input.contentHtml.includes('data-elementor-type') || input.contentHtml.includes('elementor-widget')) return 0.6;
  return 0;
}

export const elementorReader: BuilderReader = {
  id: 'elementor',
  detect,
  read: readElementor,
};
