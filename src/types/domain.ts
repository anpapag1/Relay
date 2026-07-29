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

export type ExportPostStatus = 'publish' | 'pending';

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
  postStatus: ExportPostStatus;
}

export interface GenerateWxrOptions {
  siteTitle: string;
  siteUrl: string;
  language?: string;
}

export type ImageSize = 'thumbnail' | 'medium' | 'large' | 'full' | 'custom';
export type ImageAlign = 'left' | 'center' | 'right' | 'none';
export type FileRender = 'button' | 'link' | 'embed';
export type ButtonRender = 'button' | 'link';

export interface NewSiteTerm {
  id: string;
  name: string;
  slug?: string;
}

export interface TermTable {
  id: string;
  label: string;
  terms: NewSiteTerm[];
}

export type MappingOrigin = 'suggested' | 'user';

export interface TermMapping {
  oldDomain: string;
  oldNicename: string;
  targetTableId: string | null;
  targetTermIds: string[];
  excluded: boolean;
  origin: MappingOrigin;
  score?: number;
}

export type MediaOutcome = 'matched-export' | 'matched-live' | 'unresolved' | 'unreachable';

export interface MediaResolution {
  outcome: MediaOutcome;
  url?: string;
  reason?: string;
}

/** The only place a migration's conversion choices live. writeBlocks is the
 * only module that reads these — see core/gutenberg/writeBlocks.ts. */
export interface ConversionSettings {
  imageSize: ImageSize;
  customWidth?: number;
  customHeight?: number;
  imageAlign: ImageAlign;
  autoSpacing: boolean;
  spacerSize: number;
  /** When true, writeBlocks groups runs of two or more consecutive
   * standalone images into a single wp:gallery block instead of emitting
   * each as its own wp:image. */
  combineConsecutiveImages: boolean;
  pdfRender: FileRender;
  buttonRender: ButtonRender;
  headingShift: number;
  linksNewTab: boolean;
}
