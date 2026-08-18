import type { TermRef } from '../../types/domain';

export interface TextResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type TextFetchLike = (input: string) => Promise<TextResponse>;

export type SiteSource = 'rest' | 'rss';

export interface SiteArticle {
  postId: number | null;
  title: string;
  link: string;
  postDate: string;
  postName: string;
  creator: string;
  status: string;
  contentHtml: string;
  excerptHtml: string;
  terms: TermRef[];
  featuredImageUrl?: string;
  /** Old site's `featured_media` id when it's set — mapped to `_thumbnail_id`
   * postmeta so the standard featured-image resolution (stage-1 attachment
   * match, then og:image scrape) engages even when the REST media endpoint
   * withholds the URL (e.g. a 401-private attachment). */
  thumbnailId?: string;
}

export interface SiteFetchFilter {
  startDate: string; // ISO date, e.g. "2020-01-01"
  endDate: string; // ISO date
}
