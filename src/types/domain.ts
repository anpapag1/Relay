export type PostStatus = 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash' | string;

export interface TermRef {
  domain: string;
  nicename: string;
  name: string;
}

export interface PostMeta {
  [key: string]: string;
}

export interface ParsedArticle {
  postId: number | null;
  postType: 'post' | 'page';
  status: PostStatus;
  title: string;
  link: string;
  postDate: string;
  postName: string;
  creator: string;
  contentHtml: string;
  excerptHtml: string;
  terms: TermRef[];
  postmeta: PostMeta;
}

export interface ParsedAttachment {
  postId: number | null;
  title: string;
  attachmentUrl: string;
  postParent: number | null;
}

export interface TaxonomyTermSummary {
  nicename: string;
  name: string;
  count: number;
}

export interface ParseResult {
  ok: true;
  siteUrl: string | null;
  totalItems: number;
  articles: ParsedArticle[];
  attachments: ParsedAttachment[];
  taxonomies: Record<string, TaxonomyTermSummary[]>;
  authors: string[];
  statusCounts: Record<string, number>;
}

export interface ParseError {
  ok: false;
  message: string;
}

export interface ExportTermRef {
  domain: string;
  nicename: string;
  name: string;
}

export interface ExportArticle {
  postId: number;
  title: string;
  link: string;
  postDate: string;
  postName?: string;
  authorLogin: string;
  contentHtml: string;
  terms: ExportTermRef[];
  featuredAttachmentUrl?: string | null;
}

export interface GenerateWxrOptions {
  siteTitle: string;
  siteUrl: string;
  language?: string;
}
