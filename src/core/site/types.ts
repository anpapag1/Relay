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
  contentHtml: string;
  excerptHtml: string;
  terms: TermRef[];
  featuredImageUrl?: string;
}
