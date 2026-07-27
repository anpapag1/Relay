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
});
