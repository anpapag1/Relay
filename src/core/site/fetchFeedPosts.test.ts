import { describe, it, expect } from 'vitest';
import { parseFeedXml, fetchFeedPosts, feedPageUrl } from './fetchFeedPosts';
import type { TextFetchLike } from './types';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Δήμος Μυτιλήνης</title>
  <link>https://www.mytilene.gr</link>
  <item>
    <title>Ακύρωση συναυλίας</title>
    <link>https://www.mytilene.gr/2026/08/17/akyrosi/</link>
    <dc:creator><![CDATA[ΓΡΑΦΕΙΟ ΤΥΠΟΥ]]></dc:creator>
    <pubDate>Mon, 17 Aug 2026 09:02:48 +0000</pubDate>
    <category><![CDATA[Δήμος]]></category>
    <content:encoded><![CDATA[<p>Hello &amp; goodbye</p><img src="https://www.mytilene.gr/wp-content/uploads/2026/08/pic.jpg" />]]></content:encoded>
    <image>https://www.mytilene.gr/wp-content/uploads/2026/08/pic.jpg</image>
  </item>
</channel>
</rss>`;

describe('parseFeedXml', () => {
  it('parses namespaced content and creator, categories, and the item image', () => {
    const [item] = parseFeedXml(FEED);
    expect(item.title).toBe('Ακύρωση συναυλίας');
    expect(item.link).toBe('https://www.mytilene.gr/2026/08/17/akyrosi/');
    expect(item.creator).toBe('ΓΡΑΦΕΙΟ ΤΥΠΟΥ');
    expect(item.contentHtml).toContain('<p>Hello &amp; goodbye</p>');
    expect(item.categories).toEqual(['Δήμος']);
    expect(item.featuredImageUrl).toBe('https://www.mytilene.gr/wp-content/uploads/2026/08/pic.jpg');
  });

  it('decodes double-encoded HTML entities in CDATA titles', () => {
    const xml = FEED.replace(
      '<title>Ακύρωση συναυλίας</title>',
      '<title><![CDATA[Τουρνουά μπάσκετ 3&#215;3 από τον Δήμο Μυτιλήνης]]></title>',
    );
    const [item] = parseFeedXml(xml);
    expect(item.title).toBe('Τουρνουά μπάσκετ 3×3 από τον Δήμο Μυτιλήνης');
  });
});

describe('feedPageUrl', () => {
  it('appends paged to a clean feed url', () => {
    expect(feedPageUrl('https://site.example/feed/', 2)).toBe('https://site.example/feed/?paged=2');
  });
  it('appends paged to a query-style feed url', () => {
    expect(feedPageUrl('https://site.example/?feed=rss2', 2)).toBe('https://site.example/?feed=rss2&paged=2');
  });
});

describe('fetchFeedPosts', () => {
  it('paginates with ?paged and stops at an empty page', async () => {
    const calls: string[] = [];
    const fetchImpl: TextFetchLike = async (input) => {
      calls.push(input);
      const hasPaged = /paged=(\d+)/.exec(input);
      const page = hasPaged ? Number(hasPaged[1]) : 1;
      let body: string;
      if (page === 1) {
        body = FEED;
      } else if (page === 2) {
        body = FEED.replace('</channel>', '<item><title>t2</title></item></channel>');
      } else {
        body = FEED.slice(0, FEED.indexOf('<item>'));
      }
      return { ok: true, status: 200, headers: { get: () => 'text/xml' }, text: async () => body };
    };
    const res = await fetchFeedPosts('https://site.example/feed/', fetchImpl);
    expect(res.items.length).toBe(3);
    expect(calls.some((c) => c.includes('paged=2'))).toBe(true);
    expect(res.truncated).toBe(false);
  });

  it('throws on a non-ok response instead of reporting truncation', async () => {
    const fetchImpl: TextFetchLike = async () => ({
      ok: false,
      status: 403,
      headers: { get: () => 'text/xml' },
      text: async () => 'forbidden',
    });
    await expect(fetchFeedPosts('https://site.example/feed/', fetchImpl)).rejects.toThrow(/HTTP 403/);
  });

  it('reports truncation when the MAX_PAGES cap is hit with a non-empty batch', async () => {
    const fetchImpl: TextFetchLike = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/xml' },
      text: async () => FEED,
    });
    const res = await fetchFeedPosts('https://site.example/feed/', fetchImpl);
    expect(res.truncated).toBe(true);
    expect(res.items.length).toBe(500);
  });
});

describe('fetchFeedPosts filters', () => {
  it('keeps only items inside the date range and stops at a page older than the start', async () => {
    const fetchImpl: TextFetchLike = async (input) => {
      const hasPaged = /paged=(\d+)/.exec(input);
      const page = hasPaged ? Number(hasPaged[1]) : 1;
      let body: string;
      if (page === 1) {
        body = FEED; // pubDate Mon, 17 Aug 2026
      } else if (page === 2) {
        body = FEED.replace(/<pubDate>[^<]+<\/pubDate>/, '<pubDate>Sat, 01 Aug 2026 10:00:00 +0000</pubDate>');
      } else {
        body = FEED.slice(0, FEED.indexOf('<item>'));
      }
      return { ok: true, status: 200, headers: { get: () => 'text/xml' }, text: async () => body };
    };
    const res = await fetchFeedPosts('https://site.example/feed/', fetchImpl, undefined, {
      startDate: '2026-08-10',
      endDate: '2026-08-31',
    });
    expect(res.items.length).toBe(1);
    expect(res.items[0].title).toBe('Ακύρωση συναυλίας');
    expect(res.truncated).toBe(false);
  });
});