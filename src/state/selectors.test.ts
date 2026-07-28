import { describe, expect, it } from 'vitest';
import { getArticlePreviewHtml, getDerivedArticles, getFilteredArticles, getMappingProgress, getMediaStats, getStatusCounts } from './selectors';
import { appReducer, initialState } from './reducer';
import type { ParseResult, TermTable } from '../types/domain';

const MOCK_PARSE_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 4,
  articles: [
    {
      postId: 101,
      postType: 'post',
      status: 'publish',
      title: 'Ready Article',
      link: 'https://old.example/ready/',
      postDate: '2026-01-01',
      postName: 'ready-article',
      creator: 'alice',
      contentHtml: '<p>Standard content</p>',
      excerptHtml: '',
      terms: [{ domain: 'category', nicename: 'news', name: 'News' }],
      postmeta: {},
    },
    {
      postId: 102,
      postType: 'post',
      status: 'publish',
      title: 'Review Article',
      link: 'https://old.example/review/',
      postDate: '2026-01-02',
      postName: 'review-article',
      creator: 'bob',
      contentHtml: '<p>Has unmapped term and unresolved image</p><figure><img src="https://old.example/missing.png"/></figure>',
      excerptHtml: '',
      terms: [{ domain: 'category', nicename: 'unmapped-cat', name: 'Unmapped Cat' }],
      postmeta: {},
    },
    {
      postId: 103,
      postType: 'post',
      status: 'publish',
      title: 'Edited Article',
      link: 'https://old.example/edited/',
      postDate: '2026-01-03',
      postName: 'edited-article',
      creator: 'alice',
      contentHtml: '<p>Original</p>',
      excerptHtml: '',
      terms: [],
      postmeta: {},
    },
    {
      postId: 104,
      postType: 'post',
      status: 'publish',
      title: 'Auto Excluded Article',
      link: 'https://old.example/ready/', // duplicate link/slug
      postDate: '2026-01-04',
      postName: 'ready-article',
      creator: 'alice',
      contentHtml: '<p>Duplicate</p>',
      excerptHtml: '',
      terms: [],
      postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: {
    category: [
      { nicename: 'news', name: 'News', count: 1 },
      { nicename: 'unmapped-cat', name: 'Unmapped Cat', count: 1 },
    ],
  },
  authors: ['alice', 'bob'],
  statusCounts: { publish: 4 },
};

describe('selectors', () => {
  const tables: TermTable[] = [
    {
      id: 'cats',
      label: 'Categories',
      terms: [{ id: 'cat-news', name: 'News', slug: 'news' }],
    },
  ];

  function getTestState() {
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_TARGET_TABLES', tables });
    s = appReducer(s, {
      type: 'SET_MEDIA_RESOLUTIONS',
      resolutions: {
        'https://old.example/missing.png': { outcome: 'unresolved', reason: 'Not found' },
      },
    });
    s = appReducer(s, {
      type: 'SAVE_ARTICLE_EDIT',
      articleId: 103,
      editedHtml: '<!-- wp:paragraph -->Custom<!-- /wp:paragraph -->',
    });
    return s;
  }

  it('derives article statuses correctly', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);

    expect(derived).toHaveLength(4);

    const ready = derived.find((a) => a.id === 101);
    expect(ready?.status).toBe('ready');
    expect(ready?.warnings).toHaveLength(0);

    const review = derived.find((a) => a.id === 102);
    expect(review?.status).toBe('review');
    expect(review?.warnings).toContain('Unmapped taxonomy term: "Unmapped Cat"');
    expect(review?.warnings).toContain('Not found');

    const edited = derived.find((a) => a.id === 103);
    expect(edited?.status).toBe('edited');
    expect(edited?.isEdited).toBe(true);
    expect(edited?.editedHtml).toBe('<!-- wp:paragraph -->Custom<!-- /wp:paragraph -->');

    const excluded = derived.find((a) => a.id === 104);
    expect(excluded?.status).toBe('excluded_auto');
    expect(excluded?.isExcluded).toBe(true);
  });

  it('resolves destinationTerms to the mapped new-site term, not the raw old-site term', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);

    const ready = derived.find((a) => a.id === 101);
    expect(ready?.terms).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
    expect(ready?.destinationTerms).toEqual([{ domain: 'cats', nicename: 'news', name: 'News' }]);

    // Unmapped old term resolves to no destination terms at all.
    const review = derived.find((a) => a.id === 102);
    expect(review?.destinationTerms).toEqual([]);
  });

  it('converts an article through the real reader/writeBlocks pipeline for preview', () => {
    const s = getTestState();
    const article = s.source!.articles.find((a) => a.postId === 101)!;

    const { html } = getArticlePreviewHtml(article, undefined, s);
    expect(html).toContain('wp:paragraph');
    expect(html).toContain('Standard content');
  });

  it('rewrites an attachment-id image ref to its real WXR URL in the preview, not just a real build', () => {
    // WPBakery's vc_single_image only carries an attachment ID (no URL), so
    // the reader emits `src: "attachment:<id>"`. The stage-1 match against
    // the export's own attachments (matchAttachment/resolveStage1Media) runs
    // synchronously at import time, so the preview should already show the
    // real image instead of the literal "attachment:55" placeholder.
    const parseResult: ParseResult = {
      ...MOCK_PARSE_RESULT,
      articles: [
        {
          postId: 201,
          postType: 'post',
          status: 'publish',
          title: 'Image Article',
          link: 'https://old.example/image/',
          postDate: '2026-01-05',
          postName: 'image-article',
          creator: 'alice',
          contentHtml: '[vc_single_image image="55"]',
          excerptHtml: '',
          terms: [],
          postmeta: {},
        },
      ],
      attachments: [
        { postId: 55, title: 'Photo', attachmentUrl: 'https://old.example/wp-content/uploads/photo.jpg', postParent: 201 },
      ],
    };
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: parseResult,
      defaultBuilder: 'wpbakery',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_TARGET_TABLES', tables });

    const article = s.source!.articles.find((a) => a.postId === 201)!;
    const { html, warnings } = getArticlePreviewHtml(article, undefined, s);

    expect(html).toContain('https://old.example/wp-content/uploads/photo.jpg');
    expect(html).not.toContain('attachment:55');
    expect(warnings).toHaveLength(0);
  });

  it('warns instead of silently rendering a broken image when the export has no matching attachment item', () => {
    // Same shortcode as above, but the WXR export carries no <wp:attachment>
    // for this ID at all — a real-world case where the source export simply
    // never included its media library. matchLive (the live-fetch stage)
    // can't help either, since attachment refs have no filename to match.
    const parseResult: ParseResult = {
      ...MOCK_PARSE_RESULT,
      articles: [
        {
          postId: 202,
          postType: 'post',
          status: 'publish',
          title: 'Missing Attachment Article',
          link: 'https://old.example/missing-attachment/',
          postDate: '2026-01-06',
          postName: 'missing-attachment-article',
          creator: 'alice',
          contentHtml: '[vc_single_image image="999"]',
          excerptHtml: '',
          terms: [],
          postmeta: {},
        },
      ],
      attachments: [],
    };
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: parseResult,
      defaultBuilder: 'wpbakery',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_TARGET_TABLES', tables });

    const article = s.source!.articles.find((a) => a.postId === 202)!;
    const { html, warnings } = getArticlePreviewHtml(article, undefined, s);

    expect(html).toContain('attachment:999');
    expect(warnings.some((w) => w.includes('attachment:999'))).toBe(true);
  });

  it('lets a saved editedHtml override bypass conversion entirely, like runBuild does', () => {
    const s = getTestState();
    const article = s.source!.articles.find((a) => a.postId === 101)!;

    const { html, warnings } = getArticlePreviewHtml(article, '<p>manual override</p>', s);
    expect(html).toBe('<p>manual override</p>');
    expect(warnings).toEqual([]);
  });

  it('computes status counts', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);
    const counts = getStatusCounts(derived);

    expect(counts).toEqual({
      total: 4,
      ready: 1,
      review: 1,
      edited: 1,
      excluded_auto: 1,
      excluded_manual: 0,
    });
  });

  it('filters and sorts articles', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);

    const byStatus = getFilteredArticles(derived, { status: 'review' });
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0]?.id).toBe(102);

    const byAuthor = getFilteredArticles(derived, { author: 'bob' });
    expect(byAuthor).toHaveLength(1);
    expect(byAuthor[0]?.id).toBe(102);

    const bySearch = getFilteredArticles(derived, { search: 'Edited' });
    expect(bySearch).toHaveLength(1);
    expect(bySearch[0]?.id).toBe(103);

    const sortedDateDesc = getFilteredArticles(derived, { sort: 'date-desc' });
    expect(sortedDateDesc.map((a) => a.id)).toEqual([104, 103, 102, 101]);
  });

  it('computes mapping progress', () => {
    const s = getTestState();
    const progress = getMappingProgress(s);

    expect(progress.total).toBe(2);
    expect(progress.mapped).toBe(1);
    expect(progress.percent).toBe(50);
  });

  it('computes media stats', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);
    const stats = getMediaStats(s, derived);

    expect(stats.total).toBe(1);
    expect(stats.unresolved).toBe(1);
  });
});
