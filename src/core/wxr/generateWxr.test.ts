import { describe, expect, it } from 'vitest';
import { generateWxr } from './generateWxr';
import { parseWxr } from './parseWxr';
import type { ExportArticle } from '../../types/domain';

const ARTICLES: ExportArticle[] = [
  {
    postId: 1,
    title: 'Hello World & Friends',
    link: 'https://old-site.example/hello-world/',
    postDate: '2026-01-01 00:00:00',
    authorLogin: 'admin',
    contentHtml: '<p>Body with a ]]> sequence and <em>markup</em></p>',
    terms: [
      { domain: 'category', nicename: 'news', name: 'News' },
      { domain: 'post_tag', nicename: 'greeting', name: 'Greeting & Salutations' },
    ],
    postStatus: 'publish',
  },
  {
    postId: 2,
    title: 'Second Post',
    link: 'https://old-site.example/second-post/',
    postDate: '2026-01-02 00:00:00',
    authorLogin: 'editor',
    contentHtml: '<p>Another body</p>',
    terms: [],
    postStatus: 'publish',
  },
];

describe('generateWxr', () => {
  it('emits CDATA-safe content that survives a ]]> sequence', () => {
    const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    expect(xml).toContain(']]]]><![CDATA[>');
  });

  it('derives wp:post_name from the article link when postName is not set', () => {
    const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    expect(xml).toContain('<wp:post_name><![CDATA[hello-world]]></wp:post_name>');
    expect(xml).toContain('<wp:post_name><![CDATA[second-post]]></wp:post_name>');
  });

  it('emits one <wp:author> per distinct authorLogin', () => {
    const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    const authorCount = xml.match(/<wp:author>/g)?.length ?? 0;
    expect(authorCount).toBe(2);
  });

  it('emits each article\'s own wp:status rather than hardcoding publish', () => {
    const articles: ExportArticle[] = [
      { ...ARTICLES[0], postStatus: 'pending' },
      { ...ARTICLES[1], postStatus: 'publish' },
    ];
    const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    const result = parseWxr(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.articles.find((a) => a.postId === 1)?.status).toBe('pending');
    expect(result.articles.find((a) => a.postId === 2)?.status).toBe('publish');
  });

  it('emits wp:comment_status=open for every post, so old-site comments can still be enabled on the new site', () => {
    const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    const postCommentStatuses = Array.from(xml.matchAll(/<wp:post_type><!\[CDATA\[post\]\]><\/wp:post_type>/g)).length;
    expect(postCommentStatuses).toBe(2);
    expect(xml.match(/<wp:comment_status><!\[CDATA\[open\]\]><\/wp:comment_status>/g)?.length).toBe(2);
  });

  describe('duplicate wp:post_name dedupe', () => {
    it('keeps the first occurrence\'s slug and suffixes a colliding article with -2', () => {
      const articles: ExportArticle[] = [
        { ...ARTICLES[0], postName: 'hello-world' },
        { ...ARTICLES[1], postName: 'hello-world' },
      ];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.articles.map((a) => a.postName)).toEqual(['hello-world', 'hello-world-2']);
    });

    it('skips a suffix already used by a natural slug, so a third collision becomes -3', () => {
      const articles: ExportArticle[] = [
        { ...ARTICLES[0], postName: 'hello-world' },
        { ...ARTICLES[1], postName: 'hello-world-2' },
        { ...ARTICLES[0], postName: 'hello-world', postId: 3, link: 'https://old-site.example/hello-world/3/' },
      ];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.articles.map((a) => a.postName)).toEqual(['hello-world', 'hello-world-2', 'hello-world-3']);
    });

    it('dedupes slugs derived from link or title when postName is not set', () => {
      const articles: ExportArticle[] = [
        { ...ARTICLES[0], postName: undefined, link: 'https://old-site.example/same-slug/' },
        { ...ARTICLES[1], postName: undefined, link: 'https://old-site.example/same-slug/' },
      ];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.articles.map((a) => a.postName)).toEqual(['same-slug', 'same-slug-2']);
    });

    it('does not suffix unique slugs', () => {
      const articles: ExportArticle[] = [
        { ...ARTICLES[0], postName: 'hello-world' },
        { ...ARTICLES[1], postName: 'second-post' },
      ];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.articles.map((a) => a.postName)).toEqual(['hello-world', 'second-post']);
    });
  });

  it('round-trips through parseWxr with matching counts and content', () => {
    const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    const result = parseWxr(xml);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.totalItems).toBe(ARTICLES.length);
    expect(result.articles).toHaveLength(ARTICLES.length);
    expect(result.articles[0].title).toBe('Hello World & Friends');
    expect(result.articles[0].contentHtml).toBe(ARTICLES[0].contentHtml);
    expect(result.articles[0].terms).toEqual(ARTICLES[0].terms);
    expect(result.authors.sort()).toEqual(['admin', 'editor']);
    expect(result.statusCounts.publish).toBe(2);
  });

  describe('featured images', () => {
    const SHARED_IMAGE = 'https://old-site.example/wp-content/uploads/shared.jpg';

    it('emits exactly one attachment item for a featured image shared by two articles, and matching _thumbnail_id postmeta on both', () => {
      const articles: ExportArticle[] = [
        { ...ARTICLES[0], featuredAttachmentUrl: SHARED_IMAGE },
        { ...ARTICLES[1], featuredAttachmentUrl: SHARED_IMAGE },
      ];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });

      const attachmentCount = (xml.match(/<wp:post_type><!\[CDATA\[attachment\]\]><\/wp:post_type>/g) ?? []).length;
      expect(attachmentCount).toBe(1);

      const thumbnailIds = Array.from(xml.matchAll(/<wp:meta_key><!\[CDATA\[_thumbnail_id\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(\d+)\]\]><\/wp:meta_value>/g)).map(
        (m) => m[1],
      );
      expect(thumbnailIds).toHaveLength(2);
      expect(thumbnailIds[0]).toBe(thumbnailIds[1]);
      expect(xml).toContain(`<wp:attachment_url><![CDATA[${SHARED_IMAGE}]]></wp:attachment_url>`);
    });

    it('emits no attachment item and no postmeta when no article has a featuredAttachmentUrl', () => {
      const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      expect(xml).not.toContain('_thumbnail_id');
      expect(xml).not.toContain('<![CDATA[attachment]]>');
    });

    it('parses the synthetic attachment item back out as a ParsedAttachment', () => {
      const articles: ExportArticle[] = [{ ...ARTICLES[0], featuredAttachmentUrl: SHARED_IMAGE }];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].attachmentUrl).toBe(SHARED_IMAGE);
      expect(result.articles[0].postmeta._thumbnail_id).toBe(String(result.attachments[0].postId));
    });
  });

  describe('inline media attachment items', () => {
    const SHARED_IMAGE = 'https://old-site.example/wp-content/uploads/shared.jpg';
    const INLINE_A = 'https://old-site.example/wp-content/uploads/inline-a.jpg';
    const INLINE_B = 'https://old-site.example/wp-content/uploads/inline-b.jpg';

    it('registers every inline media URL as its own synthetic attachment item, deduped by URL across articles', () => {
      const articles: ExportArticle[] = [
        { ...ARTICLES[0], mediaAttachmentUrls: [INLINE_A, INLINE_B] },
        { ...ARTICLES[1], mediaAttachmentUrls: [INLINE_A] },
      ];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments.map((a) => a.attachmentUrl).sort()).toEqual([INLINE_A, INLINE_B]);
    });

    it('dedupes a URL that is both the featured image and an inline reference into one attachment item', () => {
      const articles: ExportArticle[] = [{ ...ARTICLES[0], featuredAttachmentUrl: SHARED_IMAGE, mediaAttachmentUrls: [SHARED_IMAGE] }];
      const xml = generateWxr(articles, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attachments).toHaveLength(1);
    });

    it('emits no attachment items when mediaAttachmentUrls is absent or empty', () => {
      const xml = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
      const result = parseWxr(xml);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.attachments).toHaveLength(0);
    });
  });
});
