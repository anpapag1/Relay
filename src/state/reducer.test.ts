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

  it('handles LOAD_SOURCE, computing initial mappings and auto-exclusions', () => {
    const next = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 95,
    });

    expect(next.source).toBe(MOCK_PARSE_RESULT);
    expect(next.builderId).toBe('plainHtml');
    expect(next.builderConfidence).toBe(95);

    // Check auto exclusions
    expect(next.articles[1]).toBeUndefined();
    expect(next.articles[2]).toEqual({ excluded: true, reason: 'Duplicate slug: "first-post"', auto: true });
    expect(next.articles[3]).toEqual({ excluded: true, reason: 'Empty content', auto: true });
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
      targetTermId: 'cat-news',
      origin: 'suggested',
      score: 1,
    });
  });

  it('handles SET_TERM_MAPPING with user origin', () => {
    const next = appReducer(initialState, {
      type: 'SET_TERM_MAPPING',
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
      targetTermId: 'custom-id',
    });

    expect(next.mappings['category:news']).toEqual({
      oldDomain: 'category',
      oldNicename: 'news',
      targetTableId: 'categories',
      targetTermId: 'custom-id',
      origin: 'user',
    });
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
});
