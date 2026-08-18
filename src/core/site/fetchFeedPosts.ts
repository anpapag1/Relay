import type { SiteFetchFilter, TextFetchLike } from './types';
import { decodeHtmlEntities } from '../utils/decodeHtmlEntities';

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  creator: string;
  contentHtml: string;
  excerptHtml: string;
  categories: string[];
  featuredImageUrl?: string;
}

const DC_NS = 'http://purl.org/dc/elements/1.1/';
const CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/';
const MAX_PAGES = 500;

function childText(el: Element, ns: string | null, local: string): string {
  const found = ns ? el.getElementsByTagNameNS(ns, local) : el.getElementsByTagName(local);
  return found.length > 0 ? found[0].textContent ?? '' : '';
}

export function parseFeedXml(xmlText: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = Array.from(doc.getElementsByTagName('item'));
  return items.map((item) => {
    const featuredImage = item.getElementsByTagName('image');
    const featuredImageUrl = featuredImage.length > 0 ? featuredImage[0].textContent?.trim() || undefined : undefined;
    return {
      title: decodeHtmlEntities(childText(item, null, 'title')),
      link: childText(item, null, 'link'),
      pubDate: childText(item, null, 'pubDate'),
      creator: childText(item, DC_NS, 'creator'),
      contentHtml: childText(item, CONTENT_NS, 'encoded'),
      excerptHtml: childText(item, null, 'description'),
      categories: Array.from(item.getElementsByTagName('category')).map((c) => c.textContent ?? ''),
      featuredImageUrl,
    };
  });
}

export function feedPageUrl(feedUrl: string, page: number): string {
  const sep = feedUrl.includes('?') ? '&' : '?';
  return `${feedUrl}${sep}paged=${page}`;
}

function inDateRange(item: FeedItem, filter: SiteFetchFilter): boolean {
  const t = Date.parse(item.pubDate);
  if (Number.isNaN(t)) return true; // keep items we can't date rather than drop content
  return t >= Date.parse(`${filter.startDate}T00:00:00`) && t <= Date.parse(`${filter.endDate}T23:59:59`);
}

export async function fetchFeedPosts(
  feedUrl: string,
  fetchImpl: TextFetchLike,
  onProgress?: (fetched: number) => void,
  filter?: SiteFetchFilter,
): Promise<{ items: FeedItem[]; truncated: boolean }> {
  const items: FeedItem[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = page === 1 ? feedUrl : feedPageUrl(feedUrl, page);
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`the site returned HTTP ${res.status} for the feed URL`);
    const batch = parseFeedXml(await res.text());
    if (batch.length === 0) break;
    if (filter) {
      items.push(...batch.filter((item) => inDateRange(item, filter)));
      const startBoundary = Date.parse(`${filter.startDate}T00:00:00`);
      const pageIsOlderThanStart = batch.every((item) => {
        const t = Date.parse(item.pubDate);
        return !Number.isNaN(t) && t < startBoundary;
      });
      if (pageIsOlderThanStart) break;
    } else {
      items.push(...batch);
    }
    onProgress?.(items.length);
    if (page === MAX_PAGES) {
      truncated = true;
      break;
    }
  }

  return { items, truncated };
}