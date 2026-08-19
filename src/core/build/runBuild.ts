import type { ConversionSettings, ExportArticle, ExportTermRef, MediaResolution, ParsedArticle, ParsedAttachment, TermMapping, TermTable } from '../../types/domain';
import type { BuilderId } from '../builders/types';
import type { IRNode } from '../ir/nodes';
import { getReader } from '../builders';
import { writeBlocks } from '../gutenberg/writeBlocks';
import { generateWxr } from '../wxr/generateWxr';
import { buildAttachmentIndex, type AttachmentIndex } from '../media/attachmentIndex';
import { buildAttachmentRegistry, type AttachmentRegistry } from '../media/attachmentRegistry';
import { reviewMessages, type ReaderWarning } from '../builders/types';
import { resolveMediaRefs } from '../media/resolveMedia';
import { resolveFeaturedImage } from '../media/resolveFeaturedImage';
import { effectiveFallbackFeaturedImage } from '../media/effectiveFallbackFeaturedImage';
import type { FetchLike } from '../media/mediaClient';
import { termMappingIdOf } from '../mappings/termId';
import { collectMediaRefs, rewriteMediaRefs } from './collectMediaRefs';
import { resolveArticleTerms } from './resolveTerms';

/** Every exported post is attributed to this one fixed login rather than
 * the article's real original author — matches the reference tool: real
 * per-user authorship is remapped afterward via WordPress's own "Assign
 * Authors" screen during import, which needs matching user accounts to
 * exist on the new site anyway. Keeping it fixed here means the WXR never
 * references an old-site username the new site doesn't have. */
const MIGRATION_AUTHOR_LOGIN = 'migration';

/** A final safety net, run on the actual converted output rather than the
 * raw import HTML — matches the reference tool's build-time recheck
 * (after its own scrape/render pass). The import-time heuristic in
 * reducer.ts can miss cases where conversion itself strips everything
 * (e.g. a builder emits nothing for content it doesn't recognise), so an
 * article can still reach here with genuinely empty output. Stripping
 * only the Gutenberg block-comment wrappers (every block, including a
 * raw/unrecognised one kept verbatim, is wrapped in `<!-- wp:x -->` /
 * `<!-- /wp:x -->`) rather than every tag is what's correct here — an
 * article whose only content is a raw, non-text, non-image element (e.g.
 * a bare `<canvas>`) still has real markup worth keeping and reviewing,
 * it's just not a case a blanket tag-strip would recognise as "content". */
function isEffectivelyEmptyOutput(html: string): boolean {
  const withoutBlockComments = html.replace(/<!--\s*\/?wp:[^>]*-->/g, '');
  return !withoutBlockComments.trim();
}

/** Unmapped taxonomy terms are checked here too (not just in the UI's
 * derived article status) so that "review" — and thus the exported post
 * status when `exportPendingForReview` is on — reflects the same
 * definition everywhere, including for an article whose HTML was
 * manually edited (which has no reader pass to warn about, but can still
 * have an unmapped term). */
function unmappedTermWarnings(
  terms: ParsedArticle['terms'],
  mappings: Record<string, TermMapping>,
  newTables: TermTable[],
): string[] {
  const allTargetTerms = newTables.flatMap((t) => t.terms);
  const warnings: string[] = [];
  for (const term of terms) {
    const mapping = mappings[termMappingIdOf(term)];
    if (mapping?.excluded) continue;
    const hasValidTarget = mapping?.targetTermIds.some((id) => allTargetTerms.some((t) => t.id === id)) ?? false;
    if (!mapping || mapping.targetTermIds.length === 0 || !hasValidTarget) {
      warnings.push(`Unmapped taxonomy term: "${term.name}"`);
    }
  }
  return warnings;
}

export interface BuildArticleInput {
  article: ParsedArticle;
  excluded: boolean;
  /** Already-converted Gutenberg markup from the article drawer. When
   * set, the reader/writer are bypassed entirely and this is emitted
   * as-is (design spec §4). */
  editedHtml?: string;
  /** User-edited metadata overrides from the article drawer; the parsed
   * values fall back when unset. */
  title?: string;
  postDate?: string;
}

export type ArticleBuildStatus = 'ready' | 'review' | 'skipped';

export interface BuildArticleResult {
  postId: number | null;
  title: string;
  status: ArticleBuildStatus;
  warnings: string[];
}

export interface RunBuildOptions {
  articles: BuildArticleInput[];
  attachments: ParsedAttachment[];
  mappings: Record<string, TermMapping>;
  newTables: TermTable[];
  settings: ConversionSettings;
  builderId: BuilderId;
  siteTitle: string;
  siteUrl: string;
  fetchImpl: FetchLike;
  /** When true (the default), an article marked "review" exports with
   * wp:status=pending ("Pending Review" in wp-admin) instead of publish,
   * so it can't accidentally go live unreviewed. */
  exportPendingForReview?: boolean;
  onProgress?: (progress: { completed: number; total: number }) => void;
  isCancelled?: () => boolean;
}

export interface RunBuildResult {
  wxr: string;
  articles: BuildArticleResult[];
  cancelled: boolean;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function toExportArticle(
  input: BuildArticleInput,
  contentHtml: string,
  terms: ExportArticle['terms'],
  featuredAttachmentUrl: string | null,
  mediaAttachmentUrls: string[],
  postStatus: ExportArticle['postStatus'],
): ExportArticle {
  const article = input.article;
  return {
    postId: article.postId ?? 0,
    title: input.title ?? article.title,
    link: article.link,
    postDate: input.postDate ?? article.postDate,
    postName: article.postName || undefined,
    authorLogin: MIGRATION_AUTHOR_LOGIN,
    contentHtml,
    terms,
    featuredAttachmentUrl,
    mediaAttachmentUrls,
    postStatus,
  };
}

/** Everything about one article that can be figured out without knowing
 * the shared attachment registry — which can't exist until every
 * article's media has been resolved (see `runBuild`). An edited article
 * has no `nodes`/`resolved`/`readerWarnings` at all: the reader/writer
 * pass is bypassed entirely for it. */
interface ResolvedArticle {
  input: BuildArticleInput;
  terms: ExportTermRef[];
  featuredAttachmentUrl: string | null;
  termWarnings: string[];
  nodes?: IRNode[];
  resolved?: Record<string, MediaResolution>;
  readerWarnings?: ReaderWarning[];
}

async function resolveOneArticle(
  input: BuildArticleInput,
  options: RunBuildOptions,
  attachmentIndex: AttachmentIndex,
): Promise<ResolvedArticle> {
  const { article } = input;
  const terms = resolveArticleTerms(article.terms, options.mappings, options.newTables);
  const featuredImage = article.featuredImageUrl
    ? { outcome: 'matched-live' as const, url: article.featuredImageUrl }
    : await resolveFeaturedImage(article.postmeta, attachmentIndex, article.link || null, options.fetchImpl);
  const featuredAttachmentUrl = featuredImage?.url ?? effectiveFallbackFeaturedImage(options.settings);
  const termWarnings = unmappedTermWarnings(article.terms, options.mappings, options.newTables);

  if (input.editedHtml != null) {
    return { input, terms, featuredAttachmentUrl, termWarnings };
  }

  const reader = getReader(options.builderId);
  const { nodes, warnings: readerWarnings } = reader.read({
    contentHtml: article.contentHtml,
    postmeta: article.postmeta,
  });

  const refs = collectMediaRefs(nodes);
  const resolved = await resolveMediaRefs(refs, {
    attachments: options.attachments,
    articleUrl: article.link || null,
    fetchImpl: options.fetchImpl,
  });

  return { input, terms, featuredAttachmentUrl, termWarnings, nodes, resolved, readerWarnings };
}

function buildOneArticle(
  resolvedArticle: ResolvedArticle,
  options: RunBuildOptions,
  attachmentRegistry: AttachmentRegistry,
): { exportArticle: ExportArticle | null; result: BuildArticleResult } {
  const { input, terms, featuredAttachmentUrl, termWarnings } = resolvedArticle;
  const { article } = input;
  const exportPendingForReview = options.exportPendingForReview ?? true;

  const postStatusFor = (warnings: string[]): ExportArticle['postStatus'] =>
    exportPendingForReview && warnings.length > 0 ? 'pending' : 'publish';

  if (input.editedHtml != null) {
    const warnings = termWarnings;
    return {
      exportArticle: toExportArticle(input, input.editedHtml, terms, featuredAttachmentUrl, [], postStatusFor(warnings)),
      result: {
        postId: article.postId,
        title: input.title ?? article.title,
        status: warnings.length > 0 ? 'review' : 'ready',
        warnings,
      },
    };
  }

  const { nodes, resolved, readerWarnings } = resolvedArticle as Required<Pick<ResolvedArticle, 'nodes' | 'resolved' | 'readerWarnings'>> &
    ResolvedArticle;
  const { nodes: rewrittenNodes, warnings: mediaWarnings } = rewriteMediaRefs(nodes, resolved, attachmentRegistry);

  const contentHtml = writeBlocks(rewrittenNodes, options.settings);
  const mediaAttachmentUrls = Array.from(
    new Set(Object.values(resolved).map((r) => r.url).filter((url): url is string => Boolean(url))),
  );
  const warnings = [...termWarnings, ...reviewMessages(readerWarnings), ...mediaWarnings];

  if (isEffectivelyEmptyOutput(contentHtml)) {
    return {
      exportArticle: null,
      result: {
        postId: article.postId,
        title: input.title ?? article.title,
        status: 'skipped',
        warnings: ['Skipped: no content or media survived conversion.'],
      },
    };
  }

  return {
    exportArticle: toExportArticle(input, contentHtml, terms, featuredAttachmentUrl, mediaAttachmentUrls, postStatusFor(warnings)),
    result: {
      postId: article.postId,
      title: input.title ?? article.title,
      status: warnings.length > 0 ? 'review' : 'ready',
      warnings,
    },
  };
}

/** Two passes across the included articles, not one, because a real
 * WordPress-authored image carries its media-library attachment id
 * (`id` in the block's own JSON attrs, `wp-image-<id>` on the `<img>`)
 * and Relay's synthetic ids are deduped by URL *across the whole
 * export* (see attachmentRegistry.ts) — so no single article's id is
 * knowable until every article's media has been resolved. Pass 1
 * resolves media for every article (silent — no progress ticks; it's
 * the network-bound phase but doesn't produce output yet) and builds
 * the shared registry from all of it; pass 2 (the one progress/Cancel/
 * per-article-try-catch apply to, exactly as before) writes the actual
 * blocks now that every image's id is known, using the exact same
 * writeBlocks function the settings preview calls so preview and build
 * output can never disagree. A throw while converting one article in
 * pass 2 is caught and reported as that article failing to build,
 * marked 'review', rather than failing the whole build (design spec
 * §6). */
export async function runBuild(options: RunBuildOptions): Promise<RunBuildResult> {
  const included = options.articles.filter((input) => !input.excluded);
  const attachmentIndex = buildAttachmentIndex(options.attachments);

  const resolvedArticles: ResolvedArticle[] = [];
  for (const input of included) {
    if (options.isCancelled?.()) {
      return { wxr: '', articles: [], cancelled: true };
    }
    resolvedArticles.push(await resolveOneArticle(input, options, attachmentIndex));
  }

  const registryUrls: Array<string | null | undefined> = [];
  for (const resolvedArticle of resolvedArticles) {
    registryUrls.push(resolvedArticle.featuredAttachmentUrl);
    if (resolvedArticle.resolved) {
      for (const resolution of Object.values(resolvedArticle.resolved)) registryUrls.push(resolution.url);
    }
  }
  const attachmentRegistry = buildAttachmentRegistry(registryUrls);

  const exportArticles: ExportArticle[] = [];
  const results: BuildArticleResult[] = [];

  for (let i = 0; i < resolvedArticles.length; i += 1) {
    if (options.isCancelled?.()) {
      return { wxr: '', articles: results, cancelled: true };
    }

    const resolvedArticle = resolvedArticles[i];
    try {
      const { exportArticle, result } = buildOneArticle(resolvedArticle, options, attachmentRegistry);
      if (exportArticle) exportArticles.push(exportArticle);
      results.push(result);
    } catch (err) {
      results.push({
        postId: resolvedArticle.input.article.postId,
        title: resolvedArticle.input.title ?? resolvedArticle.input.article.title,
        status: 'review',
        warnings: [`Failed to convert this article: ${err instanceof Error ? err.message : String(err)}`],
      });
    }

    options.onProgress?.({ completed: i + 1, total: resolvedArticles.length });
    await yieldToEventLoop();
  }

  const wxr = generateWxr(exportArticles, { siteTitle: options.siteTitle, siteUrl: options.siteUrl }, attachmentRegistry);
  return { wxr, articles: results, cancelled: false };
}
