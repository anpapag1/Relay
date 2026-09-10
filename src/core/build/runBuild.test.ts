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
  combineConsecutiveImages: false,
  galleryColumns: 3,
  galleryAspectRatio: 'none',
  pdfRender: 'button',
  buttonRender: 'button',
  headingShift: 0,
  linksNewTab: true,
};

const NEVER_FETCH: FetchLike = async () => {
  throw new Error('should not be called: no media refs or featured image needed a live fetch');
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
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].status).toBe('ready');
    expect(result.articles[0].warnings).toEqual([]);
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok && parsed.articles[0].contentHtml).toBe('<!-- wp:paragraph --><p>Hand-edited</p><!-- /wp:paragraph -->');
  });

  it('applies title/postDate overrides in the exported WXR, falling back to parsed values otherwise', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postId: 1, title: 'Original Title', postDate: '2026-01-01 00:00:00' }), excluded: false, title: 'Edited Title', postDate: '2026-02-02 02:02:02' },
      { article: makeArticle({ postId: 2, title: 'Kept Title', postDate: '2026-03-03 03:03:03', postDateGmt: '2026-03-03 00:03:03' }), excluded: false },
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
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].title).toBe('Edited Title');
    expect(result.articles[1].title).toBe('Kept Title');

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles).toHaveLength(2);
    expect(parsed.articles[0].title).toBe('Edited Title');
    expect(parsed.articles[0].postDate).toBe('2026-02-02 02:02:02');
    expect(parsed.articles[1].title).toBe('Kept Title');
    expect(parsed.articles[1].postDate).toBe('2026-03-03 03:03:03');
    expect(parsed.articles[1].postDateGmt).toBe('2026-03-03 00:03:03');
  });

  it('marks an article "review" when its reader produces a warning', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ contentHtml: '<canvas width="10" height="10"></canvas>' }), excluded: false },
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

  it('reports progress after each article in each phase', async () => {
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
      fetchImpl: NEVER_FETCH,
      onProgress: (p) => progress.push(p),
    });

    // Two phases (resolve then convert), each article ticking once, sharing
    // one monotonic total so the bar never sits at 0% during the
    // network-bound resolve pass nor jumps backwards.
    expect(progress).toEqual([
      { completed: 1, total: 4, phase: 'resolve' },
      { completed: 2, total: 4, phase: 'resolve' },
      { completed: 3, total: 4, phase: 'convert' },
      { completed: 4, total: 4, phase: 'convert' },
    ]);
  });

  it('wires mapped terms through into the exported WXR', async () => {
    const newTables: TermTable[] = [{ id: 'category', label: 'Categories', terms: [{ id: 'c1', name: 'News', slug: 'news' }] }];
    const mappings: Record<string, TermMapping> = {
      'category:oldnews': { oldDomain: 'category', oldNicename: 'oldnews', targetTableId: 'category', targetTermIds: ['c1'], excluded: false, origin: 'user' },
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
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles[0].terms).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
  });

  it('exports the destination table\'s WordPress taxonomy domain, not its internal id, when mapped to a manually-created table', async () => {
    const newTables: TermTable[] = [
      { id: 'custom-table-1', domain: 'category', label: 'New Category Table 1', terms: [{ id: 'c1', name: 'News', slug: 'news' }] },
    ];
    const mappings: Record<string, TermMapping> = {
      'category:oldnews': { oldDomain: 'category', oldNicename: 'oldnews', targetTableId: 'custom-table-1', targetTermIds: ['c1'], excluded: false, origin: 'user' },
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
      fetchImpl: NEVER_FETCH,
    });

    expect(result.wxr).toContain('domain="category"');
    expect(result.wxr).not.toContain('custom-table-1');

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles[0].terms).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
  });

  it('exports the newSlug override as wp:post_name, ahead of the parsed slug', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postName: 'hello-world' }), excluded: false, newSlug: 'my-custom-slug' },
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
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles[0].postName).toBe('my-custom-slug');
  });

  it('replaces mapped categories/tags with the chosen override terms in the exported WXR', async () => {
    const newTables: TermTable[] = [
      {
        id: 'category',
        label: 'Categories',
        terms: [
          { id: 'c1', name: 'News', slug: 'news' },
          { id: 'c2', name: 'Press', slug: 'press' },
        ],
      },
      {
        id: 'post_tag',
        label: 'Tags',
        terms: [{ id: 't1', name: 'React', slug: 'react' }],
      },
    ];
    const mappings: Record<string, TermMapping> = {
      'category:oldnews': { oldDomain: 'category', oldNicename: 'oldnews', targetTableId: 'category', targetTermIds: ['c1'], excluded: false, origin: 'user' },
    };
    const articles: BuildArticleInput[] = [
      {
        article: makeArticle({ terms: [{ domain: 'category', nicename: 'oldnews', name: 'Old News' }] }),
        excluded: false,
        categoryIds: ['c2'],
        tagIds: ['t1'],
      },
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
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // The mapped News category is replaced by the overridden Press + React
    // tag; nothing from the mapping leaks through.
    expect(parsed.articles[0].terms).toEqual([
      { domain: 'category', nicename: 'press', name: 'Press' },
      { domain: 'post_tag', nicename: 'react', name: 'React' },
    ]);
  });

  it('uses ParsedArticle.featuredImageUrl directly and exports it as _thumbnail_id', async () => {
    const FEATURED = 'https://old.example/uploads/hero.jpg';
    const input: BuildArticleInput = {
      article: makeArticle({ postmeta: {}, featuredImageUrl: FEATURED }),
      excluded: false,
    };
    const { wxr } = await runBuild({
      articles: [input],
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });
    expect(wxr).toContain('_thumbnail_id');
    expect(wxr).toContain(FEATURED);
  });

  it('resolves a featured image already in the export attachments and emits it as _thumbnail_id in the WXR', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postmeta: { _thumbnail_id: '42' } }), excluded: false },
    ];
    const result = await runBuild({
      articles,
      attachments: [{ postId: 42, title: 'Featured', attachmentUrl: 'https://old.example/wp-content/uploads/featured.jpg', postParent: 1 }],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].attachmentUrl).toBe('https://old.example/wp-content/uploads/featured.jpg');
    expect(parsed.articles[0].postmeta._thumbnail_id).toBe(String(parsed.attachments[0].postId));
  });

  it('falls back to the settings fallbackFeaturedImageUrl when an article has no featured image, preferring the link over the data URL', async () => {
    const FALLBACK = 'https://new-site.example/assets/fallback.jpg';
    const DATA_FALLBACK = 'data:image/png;base64,iVBORw0KGgo=';
    const articles: BuildArticleInput[] = [{ article: makeArticle(), excluded: false }];
    const { wxr } = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: { ...SETTINGS, fallbackFeaturedImageUrl: FALLBACK, fallbackFeaturedImageDataUrl: DATA_FALLBACK },
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });

    expect(wxr).toContain('_thumbnail_id');
    expect(wxr).toContain(FALLBACK);
    expect(wxr).not.toContain(DATA_FALLBACK);
  });

  it('uses the settings fallbackFeaturedImageDataUrl as the featured image when an article has no featured image and no fallback link', async () => {
    const DATA_FALLBACK = 'data:image/png;base64,iVBORw0KGgo=';
    const articles: BuildArticleInput[] = [{ article: makeArticle(), excluded: false }];
    const { wxr } = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: { ...SETTINGS, fallbackFeaturedImageDataUrl: DATA_FALLBACK },
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });

    expect(wxr).toContain('_thumbnail_id');
    expect(wxr).toContain(DATA_FALLBACK);
  });

  it("keeps an article's own featured image when a fallback is set, ignoring the fallback", async () => {
    const FALLBACK = 'https://new-site.example/assets/fallback.jpg';
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postmeta: { _thumbnail_id: '42' } }), excluded: false },
    ];
    const { wxr } = await runBuild({
      articles,
      attachments: [{ postId: 42, title: 'Featured', attachmentUrl: 'https://old.example/wp-content/uploads/featured.jpg', postParent: 1 }],
      mappings: {},
      newTables: [],
      settings: { ...SETTINGS, fallbackFeaturedImageUrl: FALLBACK },
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });

    expect(wxr).toContain('_thumbnail_id');
    expect(wxr).toContain('https://old.example/wp-content/uploads/featured.jpg');
    expect(wxr).not.toContain(FALLBACK);
  });

  it('exports a review-flagged article as pending by default, and as publish when exportPendingForReview is false', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ contentHtml: '<canvas width="10" height="10"></canvas>' }), excluded: false },
    ];

    const pendingResult = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });
    const pendingParsed = parseWxr(pendingResult.wxr);
    expect(pendingParsed.ok).toBe(true);
    if (pendingParsed.ok) expect(pendingParsed.articles[0].status).toBe('pending');

    const publishResult = await runBuild({
      articles,
      attachments: [],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
      exportPendingForReview: false,
    });
    const publishParsed = parseWxr(publishResult.wxr);
    expect(publishParsed.ok).toBe(true);
    if (publishParsed.ok) expect(publishParsed.articles[0].status).toBe('publish');
  });

  it('exports a ready article as publish', async () => {
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
      fetchImpl: NEVER_FETCH,
    });
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.articles[0].status).toBe('publish');
  });

  it('re-checks an edited article for an unmapped taxonomy term and still exports it as pending', async () => {
    const articles: BuildArticleInput[] = [
      {
        article: makeArticle({ terms: [{ domain: 'category', nicename: 'orphan', name: 'Orphan Category' }] }),
        excluded: false,
        editedHtml: '<!-- wp:paragraph --><p>Hand-edited</p><!-- /wp:paragraph -->',
      },
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
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].status).toBe('review');
    expect(result.articles[0].warnings).toEqual(['Unmapped taxonomy term: "Orphan Category"']);
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.articles[0].status).toBe('pending');
  });

  it('exports every article with the fixed "migration" author login, regardless of the original creator', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ postId: 1, creator: 'alice' }), excluded: false },
      { article: makeArticle({ postId: 2, creator: 'bob' }), excluded: false },
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
      fetchImpl: NEVER_FETCH,
    });
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.articles.every((a) => a.creator === 'migration')).toBe(true);
    expect(parsed.authors).toEqual(['migration']);
  });

  it('registers a resolved inline image as a synthetic attachment item, not just a hotlink to the old site', async () => {
    const articles: BuildArticleInput[] = [
      {
        article: makeArticle({ contentHtml: '<figure><img src="https://old.example/wp-content/uploads/photo.jpg"/></figure>' }),
        excluded: false,
      },
    ];
    const result = await runBuild({
      articles,
      attachments: [
        { postId: 10, title: 'Photo', attachmentUrl: 'https://old.example/wp-content/uploads/photo.jpg', postParent: 1 },
      ],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].attachmentUrl).toBe('https://old.example/wp-content/uploads/photo.jpg');
  });

  it('embeds the synthetic attachment id in the image block itself, matching the attachment item\'s own id', async () => {
    const articles: BuildArticleInput[] = [
      {
        article: makeArticle({ contentHtml: '<figure><img src="https://old.example/wp-content/uploads/photo.jpg"/></figure>' }),
        excluded: false,
      },
    ];
    const result = await runBuild({
      articles,
      attachments: [
        { postId: 10, title: 'Photo', attachmentUrl: 'https://old.example/wp-content/uploads/photo.jpg', postParent: 1 },
      ],
      mappings: {},
      newTables: [],
      settings: SETTINGS,
      builderId: 'plainHtml',
      siteTitle: 'New Site',
      siteUrl: 'https://new-site.example',
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const attachmentId = parsed.attachments[0].postId;
    expect(attachmentId).not.toBeNull();
    expect(parsed.articles[0].contentHtml).toContain(`"id":${attachmentId}`);
    expect(parsed.articles[0].contentHtml).toContain(`class="wp-image-${attachmentId}"`);
  });

  it('skips an article whose conversion produced no real content or media, and reports it as "skipped"', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ contentHtml: '' }), excluded: false },
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
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].status).toBe('skipped');
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.articles).toHaveLength(0);
  });

  it('does not skip an article whose only content is raw, unrecognised markup with no text or image', async () => {
    const articles: BuildArticleInput[] = [
      { article: makeArticle({ contentHtml: '<canvas width="10" height="10"></canvas>' }), excluded: false },
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
      fetchImpl: NEVER_FETCH,
    });

    expect(result.articles[0].status).toBe('review');
    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.articles).toHaveLength(1);
  });

  it('leaves featuredAttachmentUrl unset (no postmeta, no attachment item) when the old post never had a _thumbnail_id', async () => {
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
      fetchImpl: NEVER_FETCH,
    });

    const parsed = parseWxr(result.wxr);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.attachments).toHaveLength(0);
    expect(parsed.articles[0].postmeta._thumbnail_id).toBeUndefined();
  });
});
