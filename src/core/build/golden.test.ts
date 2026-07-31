import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWxr } from '../wxr/parseWxr';
import { getReader } from '../builders';
import type { BuilderId } from '../builders/types';
import { writeBlocks } from '../gutenberg/writeBlocks';
import type { ConversionSettings, ParsedArticle } from '../../types/domain';

const FIXTURES_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../../tests/fixtures');

const DEFAULT_SETTINGS: ConversionSettings = {
  imageSize: 'large',
  imageAlign: 'center',
  autoSpacing: true,
  spacerSize: 30,
  combineConsecutiveImages: false,
  galleryColumns: 3,
  pdfRender: 'button',
  buttonRender: 'button',
  headingShift: 0,
  linksNewTab: true,
};

const BUILDERS: BuilderId[] = ['plainHtml', 'wpbakery', 'divi', 'elementor'];

function loadFixture(builderId: BuilderId): ParsedArticle {
  const xml = readFileSync(path.join(FIXTURES_DIR, `${builderId}.xml`), 'utf-8');
  const result = parseWxr(xml);
  if (!result.ok) throw new Error(`Fixture ${builderId}.xml failed to parse: ${result.message}`);

  const golden = result.articles.find((article) => article.postName === 'golden-article');
  if (!golden) throw new Error(`Fixture ${builderId}.xml has no "golden-article" post`);

  const duplicates = result.articles.filter((article) => article.postName === 'golden-article');
  if (duplicates.length < 2) throw new Error(`Fixture ${builderId}.xml is missing the duplicate-slug pair it's supposed to contain`);

  return golden;
}

/** One fixture WXR per builder (tests/fixtures/*.xml), each covering a
 * gallery, a button (where the builder has one), an image with no
 * matching attachment, and a duplicate wp:post_name pair, per design
 * spec §7. reader.read -> writeBlocks output is snapshotted so a
 * converter regression shows up as a readable diff in the .snap file
 * instead of a silent behaviour change. */
describe('golden fixtures', () => {
  for (const builderId of BUILDERS) {
    it(`converts the ${builderId} fixture to the expected Gutenberg markup`, () => {
      const article = loadFixture(builderId);
      const reader = getReader(builderId);
      const { nodes, warnings } = reader.read({ contentHtml: article.contentHtml, postmeta: article.postmeta });
      const output = writeBlocks(nodes, DEFAULT_SETTINGS);

      expect(output).toMatchSnapshot('blocks');
      expect(warnings).toMatchSnapshot('warnings');
    });
  }
});
