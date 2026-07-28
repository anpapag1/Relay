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
  },
  {
    postId: 2,
    title: 'Second Post',
    link: 'https://old-site.example/second-post/',
    postDate: '2026-01-02 00:00:00',
    authorLogin: 'editor',
    contentHtml: '<p>Another body</p>',
    terms: [],
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

  it('writes a synthetic attachment item and _thumbnail_id postmeta for a resolved featured image', () => {
    const withFeatured: ExportArticle[] = [
      { ...ARTICLES[0], featuredAttachmentUrl: 'https://old-site.example/wp-content/uploads/hero.jpg' },
      ARTICLES[1],
    ];
    const xml = generateWxr(withFeatured, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });

    expect(xml).toContain('<wp:attachment_url><![CDATA[https://old-site.example/wp-content/uploads/hero.jpg]]></wp:attachment_url>');
    expect(xml).toContain('<wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key>');
    expect((xml.match(/<wp:post_type><!\[CDATA\[attachment\]\]><\/wp:post_type>/g) ?? []).length).toBe(1);

    // No attachment item/postmeta at all when nothing resolved a featured image.
    const xmlNoFeatured = generateWxr(ARTICLES, { siteTitle: 'New Site', siteUrl: 'https://new-site.example' });
    expect(xmlNoFeatured).not.toContain('wp:attachment_url');
    expect(xmlNoFeatured).not.toContain('_thumbnail_id');
  });
});
