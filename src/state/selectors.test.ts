import { describe, expect, it } from 'vitest';
import { getArticlePreviewHtml, getDerivedArticles, getFilteredArticles, getMappingProgress, getMediaStats, getStatusCounts, hasSessionUnsavedWork } from './selectors';
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

  it('applies title/postDate metadata overrides to derived articles', () => {
    let s = getTestState();
    s = appReducer(s, { type: 'UPDATE_ARTICLE_METADATA', articleId: 101, title: 'Renamed Title', postDate: '2027-01-01 00:00:00' });
    const derived = getDerivedArticles(s);

    const overridden = derived.find((a) => a.id === 101);
    expect(overridden?.title).toBe('Renamed Title');
    expect(overridden?.postDate).toBe('2027-01-01 00:00:00');

    const untouched = derived.find((a) => a.id === 102);
    expect(untouched?.title).toBe('Review Article');
  });

  it('does not flip status to "review" for a reader note that is purely informational (e.g. the known-empty wpbakery sidebar-anchor)', () => {
    const result: ParseResult = {
      ok: true,
      siteUrl: 'https://old.example',
      totalItems: 1,
      articles: [
        {
          postId: 201,
          postType: 'post',
          status: 'publish',
          title: 'Sidebar Anchor Article',
          link: 'https://old.example/sidebar/',
          postDate: '2026-01-05',
          postName: 'sidebar-anchor-article',
          creator: 'alice',
          // base64(encodeURIComponent('<div id="sidebar-at-visual"></div>'))
          contentHtml: '[vc_raw_html]JTNDZGl2JTIwaWQlM0QlMjJzaWRlYmFyLWF0LXZpc3VhbCUyMiUzRSUzQyUyRmRpdiUzRQ==[/vc_raw_html]',
          excerptHtml: '',
          terms: [],
          postmeta: {},
        },
      ],
      attachments: [],
      taxonomies: {},
      authors: ['alice'],
      statusCounts: { publish: 1 },
    };

    let s = appReducer(initialState, { type: 'LOAD_SOURCE', result, defaultBuilder: 'wpbakery', confidence: 90 });
    s = appReducer(s, { type: 'SET_BUILDER', builderId: 'wpbakery' });
    const derived = getDerivedArticles(s);

    expect(derived).toHaveLength(1);
    expect(derived[0].status).toBe('ready');
    expect(derived[0].warnings).toHaveLength(0);
    expect(derived[0].infoWarnings.some((w) => w.includes('known-empty sidebar widget anchor'))).toBe(true);
  });

  it('forces status to "review" when an article is manually flagged, taking priority over "ready"/"edited"', () => {
    let s = getTestState();
    s = appReducer(s, { type: 'SET_ARTICLE_MANUAL_REVIEW', articleId: 101, manualReview: true });
    const derived = getDerivedArticles(s);

    const flagged = derived.find((a) => a.id === 101);
    expect(flagged?.status).toBe('review');
    expect(flagged?.isManualReview).toBe(true);
    expect(flagged?.statusReason).toBe('Flagged for review by user');

    const notFlagged = derived.find((a) => a.id === 103);
    expect(notFlagged?.isManualReview).toBe(false);
  });

  it('flags an article for review when the original content references an image file but no image/gallery block was produced', () => {
    const result: ParseResult = {
      ok: true,
      siteUrl: 'https://old.example',
      totalItems: 1,
      articles: [
        {
          postId: 301,
          postType: 'post',
          status: 'publish',
          title: 'Lost Image Article',
          link: 'https://old.example/lost-image/',
          postDate: '2026-01-06',
          postName: 'lost-image-article',
          creator: 'alice',
          // An unrecognised WPBakery shortcode: readElement's fallback for
          // an unknown tag re-serialises only the opening tag itself
          // (textFallback), discarding its children entirely - so the .jpg
          // reference inside never reaches a real image node.
          contentHtml: '[unknown_widget]<img src="https://old.example/photo.jpg">[/unknown_widget]',
          excerptHtml: '',
          terms: [],
          postmeta: {},
        },
      ],
      attachments: [],
      taxonomies: {},
      authors: ['alice'],
      statusCounts: { publish: 1 },
    };

    const s = appReducer(initialState, { type: 'LOAD_SOURCE', result, defaultBuilder: 'wpbakery', confidence: 90 });
    const derived = getDerivedArticles(s);

    expect(derived).toHaveLength(1);
    expect(derived[0].status).toBe('review');
    expect(derived[0].warnings).toContain(
      'Original content references an image file, but no image block was produced from it — check for an unconverted image.',
    );
  });

  it('computes mediaCount from the article\'s real media references, for every status including excluded/edited', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);

    // 101: <p>Standard content</p> - no media refs at all.
    expect(derived.find((a) => a.id === 101)?.mediaCount).toBe(0);
    // 102: one <img> inside a <figure> - one media ref, regardless of the
    // article also being in "review" status for an unrelated reason.
    expect(derived.find((a) => a.id === 102)?.mediaCount).toBe(1);
    // 104 is auto-excluded, but the count still reflects its real content
    // rather than defaulting to a placeholder - excluded articles aren't
    // a special case for this field.
    expect(derived.find((a) => a.id === 104)?.mediaCount).toBe(0);
  });

  it('resolves destinationTerms to the mapped new-site term, not the raw old-site term', () => {
    const s = getTestState();
    const derived = getDerivedArticles(s);

    const ready = derived.find((a) => a.id === 101);
    expect(ready?.terms).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
    expect(ready?.destinationTerms).toEqual([{ domain: 'cats', nicename: 'news', name: 'News', sourceDomain: 'category' }]);

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

  it('flags an article as review with a warning when a resolved image is confirmed broken', () => {
    // Same attachment-id shortcode/attachment setup as the matched-export
    // preview test above, but this time the health-check pass (Task 5's
    // verifyResolvedImages) has already run and merged verified:'broken'
    // back into state.media.resolved for that ref — simulating the
    // real flow without needing a live network call in this test.
    const parseResult: ParseResult = {
      ...MOCK_PARSE_RESULT,
      articles: [
        {
          postId: 301,
          postType: 'post',
          status: 'publish',
          title: 'Broken Image Article',
          link: 'https://old.example/broken-image/',
          postDate: '2026-01-07',
          postName: 'broken-image-article',
          creator: 'alice',
          contentHtml: '[vc_single_image image="77"]',
          excerptHtml: '',
          terms: [],
          postmeta: {},
        },
      ],
      attachments: [
        { postId: 77, title: 'Dead Photo', attachmentUrl: 'https://old.example/wp-content/uploads/dead.jpg', postParent: 301 },
      ],
    };
    let s = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: parseResult,
      defaultBuilder: 'wpbakery',
      confidence: 90,
    });
    s = appReducer(s, { type: 'SET_TARGET_TABLES', tables });
    s = appReducer(s, {
      type: 'SET_MEDIA_RESOLUTIONS',
      resolutions: {
        'attachment:77': {
          outcome: 'matched-export',
          url: 'https://old.example/wp-content/uploads/dead.jpg',
          verified: 'broken',
          verifiedReason: 'the old site responded with status 404',
        },
      },
    });

    const derived = getDerivedArticles(s);
    const article = derived.find((a) => a.id === 301);

    expect(article?.status).toBe('review');
    expect(article?.warnings).toContain(
      'Image link is broken: https://old.example/wp-content/uploads/dead.jpg (the old site responded with status 404)',
    );
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

describe('hasSessionUnsavedWork', () => {
  function loadedState() {
    return appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: MOCK_PARSE_RESULT,
      defaultBuilder: 'plainHtml',
      confidence: 90,
    });
  }

  it('is false right after a load, when only auto-exclusions exist', () => {
    expect(hasSessionUnsavedWork(loadedState())).toBe(false);
  });

  it('is true after a manual exclusion', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SET_ARTICLE_EXCLUDED', articleId: 101, excluded: true });
    expect(hasSessionUnsavedWork(s)).toBe(true);
  });

  it('is true after manually re-including an auto-excluded article', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SET_ARTICLE_EXCLUDED', articleId: 104, excluded: false });
    expect(hasSessionUnsavedWork(s)).toBe(true);
  });

  it('is true after flagging an article for manual review', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SET_ARTICLE_MANUAL_REVIEW', articleId: 102, manualReview: true });
    expect(hasSessionUnsavedWork(s)).toBe(true);
  });

  it('is true after saving an edit', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SAVE_ARTICLE_EDIT', articleId: 103, editedHtml: '<p>v2</p>' });
    expect(hasSessionUnsavedWork(s)).toBe(true);
  });

  it('is true after a metadata override, and false once cleared', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'UPDATE_ARTICLE_METADATA', articleId: 101, title: 'Renamed' });
    expect(hasSessionUnsavedWork(s)).toBe(true);

    s = appReducer(s, { type: 'UPDATE_ARTICLE_METADATA', articleId: 101, title: '', postDate: '' });
    expect(hasSessionUnsavedWork(s)).toBe(false);
  });

  it('is false after reverting the only saved edit', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SAVE_ARTICLE_EDIT', articleId: 103, editedHtml: '<p>v2</p>' });
    s = appReducer(s, { type: 'REVERT_ARTICLE_EDIT', articleId: 103 });
    expect(hasSessionUnsavedWork(s)).toBe(false);
  });

  it('is false after RESET_ARTICLE clears every override for that article, while other articles keep theirs', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SAVE_ARTICLE_EDIT', articleId: 103, editedHtml: '<p>v2</p>' });
    s = appReducer(s, { type: 'UPDATE_ARTICLE_METADATA', articleId: 101, title: 'Renamed' });
    s = appReducer(s, { type: 'RESET_ARTICLE', articleId: 103 });
    expect(hasSessionUnsavedWork(s)).toBe(true);

    s = appReducer(s, { type: 'RESET_ARTICLE', articleId: 101 });
    expect(hasSessionUnsavedWork(s)).toBe(false);
  });

  it('returns a pristine derived article after RESET_ARTICLE, with status re-derived', () => {
    let s = loadedState();
    s = appReducer(s, { type: 'SAVE_ARTICLE_EDIT', articleId: 103, editedHtml: '<p>v2</p>' });
    s = appReducer(s, { type: 'UPDATE_ARTICLE_METADATA', articleId: 103, title: 'Renamed' });
    s = appReducer(s, { type: 'RESET_ARTICLE', articleId: 103 });
    const derived = getDerivedArticles(s);

    const reset = derived.find((a) => a.id === 103);
    expect(reset?.status).toBe('ready');
    expect(reset?.isEdited).toBe(false);
    expect(reset?.editedHtml).toBeUndefined();
    expect(reset?.title).toBe('Edited Article');
    expect(reset?.postDate).toBe('2026-01-03');
  });
});
