import { describe, expect, it } from 'vitest';
import { runBuild, type BuildArticleInput } from './runBuild';
import { parseWxr } from '../wxr/parseWxr';
import type { ConversionSettings, ParsedArticle, TermMapping, TermTable } from '../../types/domain';
import type { FetchLike } from '../media/mediaClient';

const SETTINGS: ConversionSettings = {
  imageSize: 'large',
  imageAlign: 'center',
  autoSpacing: true,
  spacerSize: 30,
  galleryCols: 3,
  pdfRender: 'button',
  buttonRender: 'button',
  headingShift: 0,
  linksNewTab: true,
};

const NEVER_FETCH: FetchLike = async () => {
  throw new Error('should not be called when liveFetchEnabled is false');
};

function makeArticle(overrides: Partial<ParsedArticle> = {}): ParsedArticle {
  return {
    postId: 1,
    postType: 'post',
    status: 'publish',
    title: 'Hello World',
    link: 'https://old.example/hello-world/',
    postDate: '2026-01-01 00:00:00',
    postName: 'hello-world',
    creator: 'admin',
    contentHtml: '<p>Body text</p>',
    excerptHtml: '',
    terms: [],
    postmeta: {},
    ...overrides,
  };
}

describe('runBuild', () => {
  it('builds included articles into a valid, re-parseable WXR', async () => {
    const articles: BuildArticleInput[] = [{ article: makeArticle(), excluded: false }];
    const result = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
    });

    expect(result.cancelled).toBe(false);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].status).toBe('ready');

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].contentHtml).toContain('wp:paragraph');
  });

  it('excludes articles marked excluded, both from the report and the WXR', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postId: 1, title: 'Kept' }), excluded: false },
      { article: makeArticle({ postId: 2, title: 'Excluded' }), excluded: true },
    ];
    const result = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe('Kept');
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok && parsed.articles).toHaveLength(1);
  });

  it('bypasses the reader/writer for an article with editedHtml, emitting it as-is', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ contentHtml: '[vc_row][vc_column][/vc_column][/vc_row]' }), excluded: false, editedHtml: '<!-- wp:paragraph --><p>Hand-edited</p><!-- /wp:paragraph -->' },
    ];
    const result = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'wpbakery',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].status).toBe('ready');
    expect(result.articles[0].warnings).toEqual([]);
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok && parsed.articles[0].contentHtml).toBe('<!-- wp:paragraph --><p>Hand-edited</p><!-- /wp:paragraph -->');
  });

  it('marks an article "review" when its reader produces a warning', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ contentHtml: '<table><tr><td>cell</td></tr></table>' }), excluded: false },
    ];
    const result = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].status).toBe('review');
    expect(result.articles[0].warnings.length).toBeGreaterThan(0);
  });

  it('stops early and reports cancelled when isCancelled becomes true', async () => {
    let calls = 0;
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postId: 1 }), excluded: false },
      { article: makeArticle({ postId: 2 }), excluded: false },
      { article: makeArticle({ postId: 3 }), excluded: false },
    ];
    const result = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
      isCancelled: () => {
        calls += 1;
        return calls > 1;
      },
    });

    expect(result.cancelled).toBe(true);
    expect(result.wxr).toBe('');
    expect(result.articles.length).toBeLessThan(3);
  });

  it('reports progress after each article', async () => {
    const progress: Array<{ completed: number; total: number }> = [];
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postId: 1 }), excluded: false },
      { article: makeArticle({ postId: 2 }), excluded: false },
    ];
    await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
      onProgress: (p) => progress.push(p),
    });

    expect(progress).toEqual([{ completed: 1, total: 2 }, { completed: 2, total: 2 }]);
  });

  it('wires mapped terms through into the exported WXR', async () => {
    const newTables: TermTable[] = [{ id: 'category', label: 'Categories', terms: [{ id: 'c1', name: 'News', slug: 'news' }] }];
    const mappings: Record<string, TermMapping> = {
      'category:oldnews': { oldDomain: 'category', oldNicename: 'oldnews', targetTableId: 'category', targetTermId: 'c1', origin: 'user' },
    };
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ terms: [{ domain: 'category', nicename: 'oldnews', name: 'Old News' }] }), excluded: false },
    ];
    const result = await runBuild({
      articles,
      attachments: [],
      mappings,
      newTables,
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      liveFetchEnabled: false,
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles[0].terms).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
  });
});
