import { describe, expect, it } from 'vitest';
import { detectBuilder, rankBuilders } from './detectBuilder';

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

describe('rankBuilders', () => {
  it('returns all 4 registered builders', () => {
    const ranking = rankBuilders([{ contentHtml: '<p>Hi</p>', postmeta: {} }]);
    expect(ranking.map((r) => r.builderId).sort()).toEqual(['divi', 'elementor', 'plainHtml', 'wpbakery']);
  });

  it('sorts descending by confidence, with the winner matching detectBuilder', () => {
    const posts = [
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>Hi</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
    ];
    const ranking = rankBuilders(posts);
    const winner = detectBuilder(posts);

    expect(ranking[0].builderId).toBe(winner.builderId);
    expect(ranking[0].score).toBe(winner.score);
    for (let i = 1; i < ranking.length; i++) {
      const prev = ranking[i - 1];
      const cur = ranking[i];
      const prevRank = [prev.confidentCount, prev.score];
      const curRank = [cur.confidentCount, cur.score];
      expect(prevRank[0] > curRank[0] || (prevRank[0] === curRank[0] && prevRank[1] >= curRank[1])).toBe(true);
    }
  });

  it('populates confidentCount per builder', () => {
    const posts = [
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>A</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>B</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
    ];
    const ranking = rankBuilders(posts);
    const wpbakery = ranking.find((r) => r.builderId === 'wpbakery');
    expect(wpbakery?.confidentCount).toBe(2);
  });

  it('returns all builders at zero score for an empty post list, plainHtml first', () => {
    const ranking = rankBuilders([]);
    expect(ranking).toHaveLength(4);
    expect(ranking.every((r) => r.score === 0 && r.confidentCount === 0 && r.totalPosts === 0)).toBe(true);
    expect(ranking[0].builderId).toBe('plainHtml');
  });

  it('still ranks the minority builder first by confidentCount even though its average trails plainHtml\'s flat score', () => {
    // Mirrors a real mixed-content WXR export: most posts are ordinary
    // text, but a handful carry unambiguous WPBakery shortcodes. wpbakery's
    // *average* (2 * 0.95 / 20 = 0.095) is well below plainHtml's flat 0.2,
    // yet wpbakery must still win — and its confidentCount/totalPosts share
    // is what the UI should surface, not the misleading average.
    const posts = [
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>A</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
      { contentHtml: '[vc_row][vc_column][vc_column_text]<p>B</p>[/vc_column_text][/vc_column][/vc_row]', postmeta: {} },
      ...Array.from({ length: 18 }, () => ({ contentHtml: '<p>An ordinary plain post</p>', postmeta: {} })),
    ];
    const ranking = rankBuilders(posts);
    const wpbakery = ranking.find((r) => r.builderId === 'wpbakery')!;
    const plainHtml = ranking.find((r) => r.builderId === 'plainHtml')!;

    expect(ranking[0].builderId).toBe('wpbakery');
    expect(wpbakery.totalPosts).toBe(20);
    expect(wpbakery.confidentCount).toBe(2);
    expect(plainHtml.confidentCount).toBe(0);
    expect(wpbakery.score).toBeLessThan(plainHtml.score);
  });
});
