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
  /** The UTC variant of `postDate` as stored in the source WXR's
   * `wp:post_date_gmt`. Preserved so the export can write a correct GMT
   * instead of copying the local time into it. Absent for live-scraped
   * articles, which have no source GMT. */
  postDateGmt?: string;
  postName: string;
  creator: string;
  contentHtml: string;
  excerptHtml: string;
  terms: TermRef[];
  postmeta: PostMeta;
  /** Present only for posts imported via the live-site fetch path (REST
   * API / RSS feed), where the featured image is already resolved to its
   * final URL at import time. The build uses it directly instead of the
   * `_thumbnail_id` → attachment-index → og:image scrape chain. */
  featuredImageUrl?: string;
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
  /** The old-site taxonomy domain the term came from (e.g. `category`,
   * `post_tag`), carried through mapping so the UI can tell a mapped
   * category from a mapped tag regardless of the target table's id. Not
   * emitted to the WXR — `domain` remains the target table id there. */
  sourceDomain?: string;
}

export type ExportPostStatus = 'publish' | 'pending';

export interface ExportArticle {
  postId: number;
  title: string;
  link: string;
  postDate: string;
  postDateGmt?: string;
  postName?: string;
  authorLogin: string;
  contentHtml: string;
  terms: ExportTermRef[];
  featuredAttachmentUrl?: string | null;
  /** Every resolved inline media URL used in this article's content
   * (images, gallery items), regardless of whether it was matched against
   * the export's own attachments or a live scrape — Relay never carries
   * the source WXR's own `<wp:attachment>` items over verbatim, so
   * without a synthetic attachment item of its own here, an inline image
   * would import as a bare hotlink to the old (soon-to-be-decommissioned)
   * site instead of a real new-site media-library item. */
  mediaAttachmentUrls?: string[];
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
/** Matches the real Gutenberg gallery-image aspect-ratio dropdown's own
 * values exactly ("none" = "Original", the un-cropped default). */
export type GalleryAspectRatio = 'none' | '1' | '4/3' | '3/4' | '3/2' | '2/3' | '16/9' | '9/16';
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
  /** The actual WordPress taxonomy slug this table represents (e.g.
   * `category`, `post_tag`, or a custom taxonomy) — written verbatim as
   * the `domain` attribute of each exported `<category>` element, and
   * used to find "the" category/tag table for per-article overrides.
   * Falls back to `id` when unset, so tables created before this field
   * existed (which relied on `id` itself being `category`/`post_tag`)
   * keep working. */
  domain?: string;
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
  /** Set only on matched-export/matched-live outcomes, after the
   * post-import health check confirms whether the resolved URL actually
   * loads. Undefined = not yet checked. */
  verified?: 'ok' | 'broken';
  verifiedReason?: string;
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
  /** Column count for wp:gallery blocks — both the block's own "columns"
   * attribute and the figure's "columns-N" class. */
  galleryColumns: number;
  /** Crop ratio applied to every image in a gallery block — "none" (the
   * default) leaves images uncropped at their original ratio. */
  galleryAspectRatio: GalleryAspectRatio;
  pdfRender: FileRender;
  buttonRender: ButtonRender;
  headingShift: number;
  linksNewTab: boolean;
  /** The link value is portable and survives JSON export. An uploaded
   * fallback image is stored separately as a data URL that is in-session
   * only and excluded from JSON backups. */
  fallbackFeaturedImageUrl?: string;
  fallbackFeaturedImageDataUrl?: string;
}
