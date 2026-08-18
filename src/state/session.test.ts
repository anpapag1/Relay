import { describe, expect, it } from 'vitest';
import { createSiteDataBackup, restoreSiteDataBackup } from './session';
import { appReducer, initialState } from './reducer';
import type { ParseResult, TermTable } from '../types/domain';

const MOCK_PARSE_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 1,
  articles: [
    {
      postId: 1,
      postType: 'post',
      status: 'publish',
      title: 'Sample Article',
      link: 'https://old.example/sample/',
      postDate: '2026-01-01',
      postName: 'sample-article',
      creator: 'admin',
      contentHtml: '<p>Hello</p>',
      excerptHtml: '',
      terms: [{ domain: 'category', nicename: 'news', name: 'News' }],
      postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: { category: [{ nicename: 'news', name: 'News', count: 1 }] },
  authors: ['admin'],
  statusCounts: { publish: 1 },
};

describe('site data backup (Export/Import JSON on the Import tab)', () => {
  it('omits per-import bookkeeping (version/timestamp/builderId/builderConfidence) and article/media state — only taxonomy tables, mappings, and settings are portable across a different WXR', () => {
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_ARTICLE_EXCLUDED', articleId: 1, excluded: true });

    const backup = createSiteDataBackup(s);
    expect(backup).toEqual({
      targetTables: s.target.tables,
      oldTables: s.oldTables,
      mappings: s.mappings,
      settings: s.settings,
    });
    expect((backup as any).version).toBeUndefined();
    expect((backup as any).timestamp).toBeUndefined();
    expect((backup as any).builderId).toBeUndefined();
    expect((backup as any).builderConfidence).toBeUndefined();
    expect((backup as any).articles).toBeUndefined();
    expect((backup as any).mediaResolved).toBeUndefined();
  });

  it('excludes the fallback featured image data URL from a site-data backup while keeping the portable URL', () => {
    let s = appReducer(initialState, {
      type: 'UPDATE_SETTINGS',
      settings: {
        fallbackFeaturedImageUrl: 'https://example.com/fallback.jpg',
        fallbackFeaturedImageDataUrl: 'data:image/png;base64,AAAA',
      },
    });

    const backup = createSiteDataBackup(s);
    expect(backup.settings.fallbackFeaturedImageUrl).toBe('https://example.com/fallback.jpg');
    expect((backup.settings as any).fallbackFeaturedImageDataUrl).toBeUndefined();
  });

  it('round-trips the portable fallback featured image URL through a site-data backup and leaves the data URL undefined', () => {
    let s = appReducer(initialState, {
      type: 'UPDATE_SETTINGS',
      settings: {
        fallbackFeaturedImageUrl: 'https://example.com/fallback.jpg',
        fallbackFeaturedImageDataUrl: 'data:image/png;base64,AAAA',
      },
    });

    const backupJson = JSON.stringify(createSiteDataBackup(s));
    const res = restoreSiteDataBackup(backupJson, s);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.state.settings?.fallbackFeaturedImageUrl).toBe('https://example.com/fallback.jpg');
    expect((res.state.settings as any)?.fallbackFeaturedImageDataUrl).toBeUndefined();
  });

  it('restores taxonomy tables, mappings, and settings without touching builderId or article overrides', () => {
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_ARTICLE_EXCLUDED', articleId: 1, excluded: true });
    const previousBuilderId = s.builderId;
    const previousArticles = s.articles;

    const tables: TermTable[] = [
      { id: 'cats', label: 'Categories', terms: [{ id: 'cat-news', name: 'News', slug: 'news' }] },
    ];
    const backupJson = JSON.stringify({
      targetTables: { cats: tables[0] },
      mappings: {
        'category:news': {
          oldDomain: 'category',
          oldNicename: 'news',
          targetTableId: 'cats',
          targetTermIds: ['cat-news'],
          excluded: false,
          origin: 'user',
        },
      },
      settings: s.settings,
    });

    const res = restoreSiteDataBackup(backupJson, s);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.state.builderId).toBeUndefined();
    expect(res.state.articles).toBeUndefined();
    expect(res.state.media).toBeUndefined();

    const restoredState = appReducer(s, { type: 'RESTORE_SESSION', state: res.state });
    expect(restoredState.target.tables.cats).toBeDefined();
    expect(restoredState.mappings['category:news'].targetTermIds).toEqual(['cat-news']);
    // builderId and article overrides are untouched by a site-data restore.
    expect(restoredState.builderId).toBe(previousBuilderId);
    expect(restoredState.articles).toBe(previousArticles);
  });

  it('rejects malformed or incomplete JSON with the same error message as a full session restore', () => {
    const res1 = restoreSiteDataBackup('not valid json {', initialState);
    expect(res1).toEqual({
      ok: false,
      message: "Couldn't parse that JSON — check the file and try again.",
    });

    const res2 = restoreSiteDataBackup(JSON.stringify({ targetTables: {} }), initialState);
    expect(res2).toEqual({
      ok: false,
      message: "Couldn't parse that JSON — check the file and try again.",
    });
  });
});
