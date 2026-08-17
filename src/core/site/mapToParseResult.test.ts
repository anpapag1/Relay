import { describe, it, expect } from 'vitest';
import { mapToParseResult, restPostToSiteArticle, feedItemToSiteArticle } from './mapToParseResult';
import type { RestPost } from './fetchRestPosts';
import type { FeedItem } from './fetchFeedPosts';

describe('restPostToSiteArticle', () => {
  it('maps a REST post, wiring the resolved featured image', () => {
    const post: RestPost = {
      id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
      title: { rendered: 'Hello' }, content: { rendered: '<p>Hi</p>' }, featured_media: 42, status: 'publish',
      categories: [], tags: [],
    };
    const art = restPostToSiteArticle(post, 'https://cdn.example/42.jpg');
    expect(art).toEqual({
      postId: 7, title: 'Hello', link: 'https://site.example/hello/', postDate: '2026-08-17T09:00:00',
      postName: 'hello', creator: '', status: 'publish', contentHtml: '<p>Hi</p>', excerptHtml: '', terms: [],
      featuredImageUrl: 'https://cdn.example/42.jpg',
    });
  });

  it('strips plugin chrome (pdfprnt print buttons) from rendered content', () => {
    const post: RestPost = {
      id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
      title: { rendered: 'Hello' },
      content: {
        rendered:
          '<p>Body</p>' +
          '<div class="pdfprnt-buttons pdfprnt-buttons-post pdfprnt-bottom-left">' +
          '<a class="pdfprnt-button pdfprnt-button-print" href="https://site.example/hello/?print=print">Print</a>' +
          '</div>',
      },
      featured_media: 0, status: 'publish', categories: [], tags: [],
    };
    const art = restPostToSiteArticle(post);
    expect(art.contentHtml).toBe('<p>Body</p>');
  });

  it('resolves category and tag IDs into terms using the fetched taxonomy maps', () => {
    const post: RestPost = {
      id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
      title: { rendered: 'Hello' }, content: { rendered: '<p>Hi</p>' }, featured_media: 0, status: 'publish',
      categories: [13, 75], tags: [55],
    };
    const art = restPostToSiteArticle(post, undefined, {
      category: new Map([[13, { nicename: 'athlitismos', name: 'Αθλητισμός' }]]),
      post_tag: new Map([[55, { nicename: 'anakoinosi', name: 'Ανακοίνωση' }]]),
    });
    expect(art.terms).toEqual([
      { domain: 'category', nicename: 'athlitismos', name: 'Αθλητισμός' },
      { domain: 'post_tag', nicename: 'anakoinosi', name: 'Ανακοίνωση' },
    ]);
  });

  it('drops term IDs that are missing from the taxonomy maps', () => {
    const post: RestPost = {
      id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
      title: { rendered: 'Hello' }, content: { rendered: '' }, featured_media: 0, status: 'publish',
      categories: [13, 999], tags: [],
    };
    const art = restPostToSiteArticle(post, undefined, { category: new Map([[13, { nicename: 'a', name: 'A' }]]) });
    expect(art.terms).toEqual([{ domain: 'category', nicename: 'a', name: 'A' }]);
  });
});

describe('feedItemToSiteArticle', () => {
  it('maps a feed item', () => {
    const item: FeedItem = {
      title: 'T', link: 'https://site.example/x/', pubDate: 'Mon, 17 Aug 2026 09:02:48 +0000',
      creator: 'ΓΡΑΦΕΙΟ ΤΥΠΟΥ', contentHtml: '<p>c</p>', excerptHtml: 'ex', categories: ['Δήμος'],
      featuredImageUrl: 'https://site.example/i.jpg',
    };
    const art = feedItemToSiteArticle(item);
    expect(art.creator).toBe('ΓΡΑΦΕΙΟ ΤΥΠΟΥ');
    expect(art.featuredImageUrl).toBe('https://site.example/i.jpg');
  });

  it('maps feed categories to category terms (name as nicename, since feeds carry no slug)', () => {
    const art = feedItemToSiteArticle({
      title: 'T', link: 'https://site.example/x/', pubDate: '', creator: '',
      contentHtml: '', excerptHtml: '', categories: ['Δήμος', 'Εκδηλώσεις'],
    });
    expect(art.terms).toEqual([
      { domain: 'category', nicename: 'Δήμος', name: 'Δήμος' },
      { domain: 'category', nicename: 'Εκδηλώσεις', name: 'Εκδηλώσεις' },
    ]);
  });
});

describe('mapToParseResult', () => {
  it('builds a ParseResult with empty attachments/taxonomies and publish statuses', () => {
    const result = mapToParseResult({
      source: 'rss',
      baseUrl: 'https://site.example',
      articles: [feedItemToSiteArticle({ title: 'T', link: 'https://site.example/x/', pubDate: '', creator: 'A', contentHtml: '<p>c</p>', excerptHtml: '', categories: [] })],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.siteUrl).toBe('https://site.example');
    expect(result.articles[0].status).toBe('publish');
    expect(result.articles[0].contentHtml).toBe('<p>c</p>');
    expect(result.attachments).toEqual([]);
    expect(result.taxonomies).toEqual({});
    expect(result.authors).toEqual(['A']);
  });

  it('aggregates taxonomies from the fetched articles terms, counting usage', () => {
    const result = mapToParseResult({
      source: 'rest',
      baseUrl: 'https://site.example',
      articles: [
        feedItemToSiteArticle({ title: 'T1', link: 'https://site.example/1/', pubDate: '', creator: '', contentHtml: '', excerptHtml: '', categories: ['Δήμος'] }),
        feedItemToSiteArticle({ title: 'T2', link: 'https://site.example/2/', pubDate: '', creator: '', contentHtml: '', excerptHtml: '', categories: ['Δήμος', 'Εκδηλώσεις'] }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.taxonomies.category).toEqual([
      { nicename: 'Δήμος', name: 'Δήμος', count: 2 },
      { nicename: 'Εκδηλώσεις', name: 'Εκδηλώσεις', count: 1 },
    ]);
  });
});

describe('mapToParseResult statuses', () => {
  it('reflects the fetched statuses in statusCounts', () => {
    const result = mapToParseResult({
      source: 'rest',
      baseUrl: 'https://site.example',
      articles: [
        restPostToSiteArticle({ id: 1, date: '2026-08-01T09:00:00', slug: 'a', link: 'https://site.example/a/', title: { rendered: 'A' }, content: { rendered: '' }, featured_media: 0, status: 'publish', categories: [], tags: [] }),
        restPostToSiteArticle({ id: 2, date: '2026-08-02T09:00:00', slug: 'b', link: 'https://site.example/b/', title: { rendered: 'B' }, content: { rendered: '' }, featured_media: 0, status: 'draft', categories: [], tags: [] }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statusCounts).toEqual({ publish: 1, draft: 1 });
    expect(result.articles[1].status).toBe('draft');
  });
});
