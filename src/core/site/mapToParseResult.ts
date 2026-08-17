import type { ParseResult } from '../../types/domain';
import type { SiteArticle } from './types';
import type { RestPost } from './fetchRestPosts';
import type { FeedItem } from './fetchFeedPosts';

export function restPostToSiteArticle(post: RestPost, featuredUrl?: string): SiteArticle {
  return {
    postId: post.id,
    title: post.title.rendered,
    link: post.link,
    postDate: post.date,
    postName: post.slug,
    creator: '',
    contentHtml: post.content.rendered,
    excerptHtml: '',
    terms: [],
    featuredImageUrl: featuredUrl,
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
    contentHtml: item.contentHtml,
    excerptHtml: item.excerptHtml,
    terms: [],
    featuredImageUrl: item.featuredImageUrl,
  };
}

export function mapToParseResult(data: { source: 'rest' | 'rss'; baseUrl: string; articles: SiteArticle[] }): ParseResult {
  const authors = Array.from(new Set(data.articles.map((a) => a.creator).filter(Boolean)));
  return {
    ok: true,
    siteUrl: data.baseUrl,
    totalItems: data.articles.length,
    articles: data.articles.map((a) => ({
      postId: a.postId,
      postType: 'post',
      status: 'publish',
      title: a.title,
      link: a.link,
      postDate: a.postDate,
      postName: a.postName,
      creator: a.creator,
      contentHtml: a.contentHtml,
      excerptHtml: a.excerptHtml,
      terms: a.terms,
      postmeta: {},
      featuredImageUrl: a.featuredImageUrl,
    })),
    attachments: [],
    taxonomies: {},
    authors,
    statusCounts: { publish: data.articles.length },
  };
}
