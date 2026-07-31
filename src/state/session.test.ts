import { describe, expect, it } from 'vitest';
import { createSessionBackup, createSiteDataBackup, loadFromLocalStorage, restoreSessionBackup, restoreSiteDataBackup, saveToLocalStorage } from './session';
import { appReducer, initialState } from './reducer';
import { getDerivedArticles } from './selectors';
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

describe('session backup', () => {
  it('creates a session backup without round-tripping derived statuses', () => {
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_ARTICLE_EXCLUDED', articleId: 1, excluded: true });

    const backup = createSessionBackup(s);
    expect(backup.version).toBe(1);
    expect(backup.builderId).toBe('plainHtml');
    expect(backup.articles[1]).toEqual({ excluded: true, reason: 'Excluded by user', auto: false });

    // Verify derived statuses or entire articles array are NOT stored in backup
    expect((backup as any).source).toBeUndefined();
    expect((backup as any).derivedArticles).toBeUndefined();
  });

  it('restores a session backup and recomputes derived status', () => {
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 90,
    });

    const tables: TermTable[] = [
      {
        id: 'cats',
        label: 'Categories',
        terms: [{ id: 'cat-news', name: 'News', slug: 'news' }],
      },
    ];

    const backupJson = JSON.stringify({
      version: 1,
      timestamp: '2026-07-27T00:00:00.000Z',
      builderId: 'plainHtml',
      builderConfidence: 90,
      targetTables: { cats: tables[0] },
      mappings: {
        'category:news': {
          oldDomain: 'category',
          oldNicename: 'news',
          targetTableId: 'cats',
          targetTermId: 'cat-news',
          origin: 'user',
        },
      },
      settings: s.settings,
      articles: { 1: { editedHtml: '<p>Restored edit</p>' } },
      mediaResolved: {},
    });

    const res = restoreSessionBackup(backupJson, s);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const restoredState = appReducer(s, { type: 'RESTORE_SESSION', state: res.state });
    expect(restoredState.target.tables.cats).toBeDefined();

    // Legacy backups used a singular `targetTermId` — restore normalizes it into the array shape.
    expect(restoredState.mappings['category:news']).toEqual({
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'cats',
      targetTermIds: ['cat-news'],
      excluded: false,
      origin: 'user',
      score: undefined,
    });

    // Verify derived status recomputes from restored overrides
    const derived = getDerivedArticles(restoredState);
    expect(derived[0]?.status).toBe('edited');
    expect(derived[0]?.editedHtml).toBe('<p>Restored edit</p>');
  });

  it('returns exact error message on malformed JSON or version mismatch', () => {
    const res1 = restoreSessionBackup('not valid json {', initialState);
    expect(res1).toEqual({
      ok: false,
      message: "Couldn't parse that JSON — check the file and try again.",
    });

    const res2 = restoreSessionBackup(JSON.stringify({ version: 2 }), initialState);
    expect(res2).toEqual({
      ok: false,
      message: "Couldn't parse that JSON — check the file and try again.",
    });

    const res3 = restoreSessionBackup(null, initialState);
    expect(res3).toEqual({
      ok: false,
      message: "Couldn't parse that JSON — check the file and try again.",
    });
  });

  it('handles localStorage autosave cleanly', () => {
    const mockStorage: Record<string, string> = {};
    const mockWin = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
      },
    };

    const origWin = (globalThis as any).window;
    (globalThis as any).window = mockWin;

    try {
      const s = appReducer(initialState, { type: 'SET_ARTICLE_EXCLUDED', articleId: 1, excluded: true });
      saveToLocalStorage(s, 0); // synchronous for testing

      // Advance timer if any
      const loaded = loadFromLocalStorage(initialState);
      expect(loaded?.articles?.[1]).toEqual({ excluded: true, reason: 'Excluded by user', auto: false });
    } finally {
      (globalThis as any).window = origWin;
    }
  });
});

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
