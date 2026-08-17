import { describe, it, expect } from 'vitest';
import { mapToParseResult, restPostToSiteArticle, feedItemToSiteArticle } from './mapToParseResult';
import type { RestPost } from './fetchRestPosts';
import type { FeedItem } from './fetchFeedPosts';

describe('restPostToSiteArticle', () => {
  it('maps a REST post, wiring the resolved featured image', () => {
    const post: RestPost = {
      id: 7, date: '2026-08-17T09:00:00', slug: 'hello', link: 'https://site.example/hello/',
      title: { rendered: 'Hello' }, content: { rendered: '<p>Hi</p>' }, featured_media: 42, status: 'publish',
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
      featured_media: 0, status: 'publish',
    };
    const art = restPostToSiteArticle(post);
    expect(art.contentHtml).toBe('<p>Body</p>');
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
});

describe('mapToParseResult statuses', () => {
  it('reflects the fetched statuses in statusCounts', () => {
    const result = mapToParseResult({
      source: 'rest',
      baseUrl: 'https://site.example',
      articles: [
        restPostToSiteArticle({ id: 1, date: '2026-08-01T09:00:00', slug: 'a', link: 'https://site.example/a/', title: { rendered: 'A' }, content: { rendered: '' }, featured_media: 0, status: 'publish' }),
        restPostToSiteArticle({ id: 2, date: '2026-08-02T09:00:00', slug: 'b', link: 'https://site.example/b/', title: { rendered: 'B' }, content: { rendered: '' }, featured_media: 0, status: 'draft' }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statusCounts).toEqual({ publish: 1, draft: 1 });
    expect(result.articles[1].status).toBe('draft');
  });
});
