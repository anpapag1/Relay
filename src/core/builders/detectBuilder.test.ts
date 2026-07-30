import { describe, expect, it } from 'vitest';
import { detectBuilder } from './detectBuilder';

describe('detectBuilder', () => {
  it('detects wpbakery from vc_row/vc_column shortcodes', () => {
    const result = detectBuilder([
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>Hi</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
    ]);
    expect(result.builderId).toBe('wpbakery');
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('detects divi from et_pb_ shortcodes', () => {
    const result = detectBuilder([
      { contentHtml: '[et_pb_section][et_pb_row][et_pb_column][et_pb_text]<p>Hi</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]', postmeta: {} },
    ]);
    expect(result.builderId).toBe('divi');
  });

  it('detects elementor from _elementor_data postmeta', () => {
    const result = detectBuilder([{ contentHtml: '<p>Hi</p>', postmeta: { _elementor_data: '[]' } }]);
    expect(result.builderId).toBe('elementor');
  });

  it('falls back to plainHtml for ordinary HTML content', () => {
    const result = detectBuilder([{ contentHtml: '<p>Just a plain post</p>', postmeta: {} }]);
    expect(result.builderId).toBe('plainHtml');
  });

  it('returns plainHtml with a zero score for an empty post list', () => {
    expect(detectBuilder([])).toEqual({ builderId: 'plainHtml', score: 0 });
  });

  it('averages confidence across multiple posts', () => {
    const result = detectBuilder([
      { contentHtml: '[vc_row][vc_column][/vc_column][/vc_row]', postmeta: {} },
      { contentHtml: '<p>plain</p>', postmeta: {} },
    ]);
    expect(result.builderId).toBe('wpbakery');
  });

  it('still picks wpbakery when its shortcodes only appear in a small minority of posts, not plainHtml\'s flat per-post score', () => {
    // A site that migrated builders partway through, or has some
    // already-Gutenberg-native posts mixed in with WPBakery ones: only
    // 2 of 20 posts have real vc_row/vc_column shortcodes, so wpbakery's
    // *average* score (2 * 0.95 / 20 = 0.095) is well below plainHtml's
    // flat 0.2 — but wpbakery is still unambiguously the real builder
    // wherever it actually shows up, and should still win.
    const posts = [
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>A</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>B</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
      ...Array.from({ length: 18 }, () => ({ contentHtml: '<p>An ordinary plain post</p>', postmeta: {} })),
    ];
    const result = detectBuilder(posts);
    expect(result.builderId).toBe('wpbakery');
  });
});
