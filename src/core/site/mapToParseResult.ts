import type { ParseResult, TaxonomyTermSummary, TermRef } from '../../types/domain';
import type { SiteArticle } from './types';
import type { RestPost } from './fetchRestPosts';
import type { FeedItem } from './fetchFeedPosts';
import { TAXONOMIES, type TaxonomyMaps } from './fetchRestTaxonomies';
import { cleanSiteContent } from './cleanSiteContent';
import { decodeHtmlEntities } from '../utils/decodeHtmlEntities';

function resolveRestTerms(post: RestPost, taxonomyMaps: TaxonomyMaps): TermRef[] {
  const terms: TermRef[] = [];
  for (const { domain, field } of TAXONOMIES) {
    const byId = taxonomyMaps[domain];
    if (!byId) continue;
    const ids = post[field] ?? [];
    for (const id of ids) {
      const resolved = byId.get(id);
      if (!resolved) continue;
      terms.push({ domain, nicename: resolved.nicename, name: resolved.name });
    }
  }
  return terms;
}

export function restPostToSiteArticle(post: RestPost, featuredUrl?: string, taxonomyMaps?: TaxonomyMaps): SiteArticle {
  return {
    postId: post.id,
    title: decodeHtmlEntities(post.title.rendered),
    link: post.link,
    postDate: post.date,
    postName: post.slug,
    creator: '',
    status: post.status,
    contentHtml: cleanSiteContent(post.content.rendered),
    excerptHtml: '',
    terms: taxonomyMaps ? resolveRestTerms(post, taxonomyMaps) : [],
    featuredImageUrl: featuredUrl,
    thumbnailId: post.featured_media > 0 ? String(post.featured_media) : undefined,
  };
}

export function feedItemToSiteArticle(item: FeedItem): SiteArticle {
  return {
    postId: null,
    title: item.title,
    link: item.link,
    postDate: item.pubDate,
    postName: '',
    creator: item.creator,
    status: 'publish',
    contentHtml: cleanSiteContent(item.contentHtml),
    excerptHtml: item.excerptHtml,
    terms: item.categories.map((name) => ({ domain: 'category', nicename: name, name })),
    featuredImageUrl: item.featuredImageUrl,
  };
}

function aggregateTaxonomies(articles: SiteArticle[]): Record<string, TaxonomyTermSummary[]> {
  const byDomain = new Map<string, Map<string, TaxonomyTermSummary>>();
  for (const article of articles) {
    for (const term of article.terms) {
      if (!term.domain) continue;
      let byNicename = byDomain.get(term.domain);
      if (!byNicename) {
        byNicename = new Map();
        byDomain.set(term.domain, byNicename);
      }
      const existing = byNicename.get(term.nicename);
      if (existing) {
        existing.count += 1;
      } else {
        byNicename.set(term.nicename, { nicename: term.nicename, name: term.name, count: 1 });
      }
    }
  }
  return Object.fromEntries(Array.from(byDomain.entries()).map(([domain, map]) => [domain, Array.from(map.values())]));
}

/** Merges the fetched full taxonomy lists (every category/tag on the source
 * site, not just ones used by the imported articles) with the article-usage
 * counts, so unused terms still surface for mapping. Terms with no article
 * usage carry `count: 0`. */
function mergeTaxonomyMaps(
  aggregated: Record<string, TaxonomyTermSummary[]>,
  taxonomyMaps: TaxonomyMaps,
): Record<string, TaxonomyTermSummary[]> {
  const result: Record<string, TaxonomyTermSummary[]> = {};
  for (const { domain } of TAXONOMIES) {
    const full = taxonomyMaps[domain];
    if (!full) continue;
    const byNicename = new Map<string, TaxonomyTermSummary>();
    for (const term of full.values()) {
      byNicename.set(term.nicename, { nicename: term.nicename, name: term.name, count: 0 });
    }
    for (const term of aggregated[domain] ?? []) {
      byNicename.set(term.nicename, { ...term });
    }
    result[domain] = Array.from(byNicename.values());
  }
  for (const [domain, terms] of Object.entries(aggregated)) {
    if (result[domain]) continue;
    result[domain] = terms;
  }
  return result;
}

export function mapToParseResult(data: { baseUrl: string; articles: SiteArticle[]; taxonomyMaps?: TaxonomyMaps }): ParseResult {
  const authors = Array.from(new Set(data.articles.map((a) => a.creator).filter(Boolean)));
  return {
    ok: true,
    siteUrl: data.baseUrl,
    totalItems: data.articles.length,
    articles: data.articles.map((a) => ({
      postId: a.postId,
      postType: 'post',
      status: a.status,
      title: a.title,
      link: a.link,
      postDate: a.postDate,
      postName: a.postName,
      creator: a.creator,
      contentHtml: a.contentHtml,
      excerptHtml: a.excerptHtml,
      terms: a.terms,
      postmeta: a.thumbnailId ? { _thumbnail_id: a.thumbnailId } : ({} as Record<string, never>),
      featuredImageUrl: a.featuredImageUrl,
    })),
    attachments: [],
    taxonomies: data.taxonomyMaps ? mergeTaxonomyMaps(aggregateTaxonomies(data.articles), data.taxonomyMaps) : aggregateTaxonomies(data.articles),
    authors,
    statusCounts: data.articles.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
