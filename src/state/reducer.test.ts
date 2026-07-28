import { describe, expect, it } from 'vitest';
import { appReducer, initialState } from './reducer';
import type { ParseResult, TermTable } from '../types/domain';

const MOCK_PARSE_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 3,
  articles: [
    {
      postId: 1,
      postType: 'post',
      status: 'publish',
      title: 'First Post',
      link: 'https://old.example/first/',
      postDate: '2026-01-01',
      postName: 'first-post',
      creator: 'admin',
      contentHtml: '<p>Hello world</p>',
      excerptHtml: '',
      terms: [{ domain: 'category', nicename: 'news', name: 'News' }],
      postmeta: {},
    },
    {
      postId: 2,
      postType: 'post',
      status: 'publish',
      title: 'Duplicate Slug Post',
      link: 'https://old.example/first-dup/',
      postDate: '2026-01-02',
      postName: 'first-post', // duplicate slug!
      creator: 'admin',
      contentHtml: '<p>Some text</p>',
      excerptHtml: '',
      terms: [],
      postmeta: {},
    },
    {
      postId: 3,
      postType: 'post',
      status: 'publish',
      title: 'Empty Post',
      link: 'https://old.example/empty/',
      postDate: '2026-01-03',
      postName: 'empty-post',
      creator: 'admin',
      contentHtml: '   <br/>  ', // empty content!
      excerptHtml: '',
      terms: [],
      postmeta: {},
    },
  ],
  attachments: [
    {
      postId: 10,
      title: 'Photo',
      attachmentUrl: 'https://old.example/wp-content/uploads/photo.jpg',
      postParent: 1,
    },
  ],
  taxonomies: {
    category: [{ nicename: 'news', name: 'News', count: 1 }],
  },
  authors: ['admin'],
  statusCounts: { publish: 3 },
};

describe('appReducer', () => {
  it('returns initial state by default', () => {
    expect(appReducer(undefined, { type: 'CLEAR_SOURCE' })).toEqual(initialState);
  });

  it('handles LOAD_SOURCE, computing auto-exclusions, and leaves oldTables/mappings untouched', () => {
    const next = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 95,
    });

    expect(next.source).toBe(MOCK_PARSE_RESULT);
    expect(next.builderId).toBe('plainHtml');
    expect(next.builderConfidence).toBe(95);

    // LOAD_SOURCE no longer auto-populates old-site tables or mappings —
    // that's now the reconciliation hint's job (see reconcileOldTables.ts).
    expect(next.oldTables).toEqual({});
    expect(next.mappings).toEqual({});

    // Check auto exclusions
    expect(next.articles[1]).toBeUndefined();
    expect(next.articles[2]).toEqual({ excluded: true, reason: 'Duplicate slug: "first-post"', auto: true });
    expect(next.articles[3]).toEqual({ excluded: true, reason: 'Empty content', auto: true });
  });

  it('preserves oldTables that already exist (e.g. from a JSON import) across LOAD_SOURCE', () => {
    const withOldTables = {
      ...initialState,
      oldTables: {
        category: { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
      },
    };
    const next = appReducer(withOldTables, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 95,
    });

    expect(next.oldTables).toEqual(withOldTables.oldTables);
  });

  it('handles SET_TARGET_TABLES and updates mappings', () => {
    const loaded = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 95,
    });

    const tables: TermTable[] = [
      {
        id: 'categories',
        label: 'Categories',
        terms: [{ id: 'cat-news', name: 'News', slug: 'news' }],
      },
    ];

    const next = appReducer(loaded, { type: 'SET_TARGET_TABLES', tables });
    expect(next.target.tables.categories).toBeDefined();
    expect(next.mappings['category:news']).toEqual({
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
      targetTermIds: ['cat-news'],
      excluded: false,
      origin: 'suggested',
      score: 1,
    });
  });

  it('handles SET_OLD_TABLES and computes suggestions against existing target tables', () => {
    const tables: TermTable[] = [
      {
        id: 'categories',
        label: 'Categories',
        terms: [{ id: 'cat-news', name: 'News', slug: 'news' }],
      },
    ];
    const loaded = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 95,
    });
    const withTargets = appReducer(loaded, { type: 'SET_TARGET_TABLES', tables });
    // Clear mappings to simulate reconciliation adding old-site terms after
    // target tables were already configured, with no suggestion yet.
    const cleared = { ...withTargets, mappings: {} };

    const oldTables: TermTable[] = [
      { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
    ];
    const next = appReducer(cleared, { type: 'SET_OLD_TABLES', tables: oldTables });

    expect(next.mappings['category:news']).toEqual({
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
      targetTermIds: ['cat-news'],
      excluded: false,
      origin: 'suggested',
      score: 1,
    });
  });

  it('handles SET_TERM_ACTION with user origin, clearing prior destinations', () => {
    const next = appReducer(initialState, {
      type: 'SET_TERM_ACTION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
    });

    expect(next.mappings['category:news']).toEqual({
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
      targetTermIds: [],
      excluded: false,
      origin: 'user',
    });
  });

  it('handles ADD_TERM_DESTINATION and REMOVE_TERM_DESTINATION', () => {
    const withAction = appReducer(initialState, {
      type: 'SET_TERM_ACTION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
    });
    const added = appReducer(withAction, {
      type: 'ADD_TERM_DESTINATION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTermId: 'custom-id',
    });
    expect(added.mappings['category:news'].targetTermIds).toEqual(['custom-id']);
    expect(added.mappings['category:news'].origin).toBe('user');

    // Adding the same id again is a no-op (deduped)
    const addedAgain = appReducer(added, {
      type: 'ADD_TERM_DESTINATION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTermId: 'custom-id',
    });
    expect(addedAgain.mappings['category:news'].targetTermIds).toEqual(['custom-id']);

    const removed = appReducer(added, {
      type: 'REMOVE_TERM_DESTINATION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTermId: 'custom-id',
    });
    expect(removed.mappings['category:news'].targetTermIds).toEqual([]);
  });

  it('handles SET_TERM_EXCLUDED, preserving destinations for undo', () => {
    const withAction = appReducer(initialState, {
      type: 'SET_TERM_ACTION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
    });
    const added = appReducer(withAction, {
      type: 'ADD_TERM_DESTINATION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTermId: 'custom-id',
    });

    const excluded = appReducer(added, {
      type: 'SET_TERM_EXCLUDED',
      oldDomain: 'category',
      oldNicename: 'news',
      excluded: true,
    });
    expect(excluded.mappings['category:news'].excluded).toBe(true);
    expect(excluded.mappings['category:news'].targetTermIds).toEqual(['custom-id']);

    const undone = appReducer(excluded, {
      type: 'SET_TERM_EXCLUDED',
      oldDomain: 'category',
      oldNicename: 'news',
      excluded: false,
    });
    expect(undone.mappings['category:news'].excluded).toBe(false);
    expect(undone.mappings['category:news'].targetTermIds).toEqual(['custom-id']);
  });

  it('handles CLEAR_ALL_MAPPINGS', () => {
    const withAction = appReducer(initialState, {
      type: 'SET_TERM_ACTION',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
    });
    const cleared = appReducer(withAction, { type: 'CLEAR_ALL_MAPPINGS' });
    expect(cleared.mappings).toEqual({});
  });

  it('handles SET_DESTINATION_PICKER', () => {
    const opened = appReducer(initialState, { type: 'SET_DESTINATION_PICKER', termId: 'category:news' });
    expect(opened.ui.pickers.destinationTermId).toBe('category:news');
    const closed = appReducer(opened, { type: 'SET_DESTINATION_PICKER', termId: null });
    expect(closed.ui.pickers.destinationTermId).toBeNull();
  });

  it('handles SET_ARTICLE_EXCLUDED and removes auto flag', () => {
    const loaded = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 95,
    });

    // Manually exclude postId 1
    const next1 = appReducer(loaded, { type: 'SET_ARTICLE_EXCLUDED', articleId: 1, excluded: true });
    expect(next1.articles[1]).toEqual({ excluded: true, reason: 'Excluded by user', auto: false });

    // Manually include postId 2 (which was auto excluded)
    const next2 = appReducer(next1, { type: 'SET_ARTICLE_EXCLUDED', articleId: 2, excluded: false });
    expect(next2.articles[2]).toEqual({ excluded: false, reason: undefined, auto: false });
  });

  it('handles SAVE_ARTICLE_EDIT and REVERT_ARTICLE_EDIT', () => {
    const edited = appReducer(initialState, { type: 'SAVE_ARTICLE_EDIT', articleId: 1, editedHtml: '<!-- wp:paragraph -->Edited<!-- /wp:paragraph -->' });
    expect(edited.articles[1]?.editedHtml).toBe('<!-- wp:paragraph -->Edited<!-- /wp:paragraph -->');

    const reverted = appReducer(edited, { type: 'REVERT_ARTICLE_EDIT', articleId: 1 });
    expect(reverted.articles[1]?.editedHtml).toBeUndefined();
  });

  it('handles build lifecycle actions', () => {
    const start = appReducer(initialState, { type: 'START_BUILD' });
    expect(start.build.running).toBe(true);

    const progress = appReducer(start, { type: 'BUILD_PROGRESS', completed: 1, total: 3, logLine: 'Processed item 1' });
    expect(progress.build.progress).toEqual({ completed: 1, total: 3 });
    expect(progress.build.log).toContain('Processed item 1');

    const cancel = appReducer(progress, { type: 'CANCEL_BUILD' });
    expect(cancel.build.running).toBe(false);
    expect(cancel.build.cancelled).toBe(true);
  });

  describe('AUTO_MATCH_MAPPINGS', () => {
    it('replaces every mapping - including manual exclusions and choices - with fresh matches, excluding non-matches', () => {
      let state = appReducer(initialState, {
        type: 'LOAD_SOURCE',
        result: MOCK_PARSE_RESULT,
        defaultBuilder: 'plainHtml',
        confidence: 90,
      });
      state = appReducer(state, {
        type: 'SET_TARGET_TABLES',
        tables: [{ id: 'cats', label: 'Categories', terms: [{ id: 'c1', name: 'News' }] }],
      });
      state = appReducer(state, {
        type: 'SET_OLD_TABLES',
        tables: [
          {
            id: 'category',
            label: 'Category',
            terms: [
              { id: 'news', name: 'News', slug: 'news' },
              { id: 'unrelated', name: 'Completely Unrelated Topic', slug: 'unrelated' },
            ],
          },
        ],
      });
      // A manual choice that AUTO_MATCH_MAPPINGS must discard.
      state = appReducer(state, { type: 'SET_TERM_EXCLUDED', oldDomain: 'category', oldNicename: 'news', excluded: true });

      const next = appReducer(state, { type: 'AUTO_MATCH_MAPPINGS' });

      expect(next.mappings['category:news']).toMatchObject({
        targetTableId: 'cats',
        targetTermIds: ['c1'],
        excluded: false,
      });
      expect(next.mappings['category:unrelated']).toMatchObject({
        targetTableId: null,
        targetTermIds: [],
        excluded: true,
      });
    });

    it('is a no-op producing an empty mapping set when there are no old-site tables', () => {
      const next = appReducer(initialState, { type: 'AUTO_MATCH_MAPPINGS' });
      expect(next.mappings).toEqual({});
    });
  });
});
