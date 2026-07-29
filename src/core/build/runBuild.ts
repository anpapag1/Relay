import type { ConversionSettings, ExportArticle, ParsedArticle, ParsedAttachment, TermMapping, TermTable } from '../../types/domain';
import type { BuilderId } from '../builders/types';
import { getReader } from '../builders';
import { writeBlocks } from '../gutenberg/writeBlocks';
import { generateWxr } from '../wxr/generateWxr';
import { buildAttachmentIndex, type AttachmentIndex } from '../media/attachmentIndex';
import { reviewMessages } from '../builders/types';
import { resolveMediaRefs } from '../media/resolveMedia';
import { resolveFeaturedImage } from '../media/resolveFeaturedImage';
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
  article: ParsedArticle,
  contentHtml: string,
  terms: ExportArticle['terms'],
  featuredAttachmentUrl: string | null,
  mediaAttachmentUrls: string[],
  postStatus: ExportArticle['postStatus'],
): ExportArticle {
  return {
    postId: article.postId ?? 0,
    title: article.title,
    link: article.link,
    postDate: article.postDate,
    postName: article.postName || undefined,
    authorLogin: MIGRATION_AUTHOR_LOGIN,
    contentHtml,
    terms,
    featuredAttachmentUrl,
    mediaAttachmentUrls,
    postStatus,
  };
}

async function buildOneArticle(
  input: BuildArticleInput,
  options: RunBuildOptions,
  attachmentIndex: AttachmentIndex,
): Promise<{ exportArticle: ExportArticle | null; result: BuildArticleResult }> {
  const { article } = input;
  const terms = resolveArticleTerms(article.terms, options.mappings, options.newTables);
  const featuredImage = await resolveFeaturedImage(article.postmeta, attachmentIndex, article.link || null, options.fetchImpl);
  const featuredAttachmentUrl = featuredImage?.url ?? null;
  const exportPendingForReview = options.exportPendingForReview ?? true;
  const termWarnings = unmappedTermWarnings(article.terms, options.mappings, options.newTables);

  const postStatusFor = (warnings: string[]): ExportArticle['postStatus'] =>
    exportPendingForReview && warnings.length > 0 ? 'pending' : 'publish';

  if (input.editedHtml != null) {
    const warnings = termWarnings;
    return {
      exportArticle: toExportArticle(article, input.editedHtml, terms, featuredAttachmentUrl, [], postStatusFor(warnings)),
      result: {
        postId: article.postId,
        title: article.title,
        status: warnings.length > 0 ? 'review' : 'ready',
        warnings,
      },
    };
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
  const { nodes: rewrittenNodes, warnings: mediaWarnings } = rewriteMediaRefs(nodes, resolved);

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
        title: article.title,
        status: 'skipped',
        warnings: ['Skipped: no content or media survived conversion.'],
      },
    };
  }

  return {
    exportArticle: toExportArticle(article, contentHtml, terms, featuredAttachmentUrl, mediaAttachmentUrls, postStatusFor(warnings)),
    result: {
      postId: article.postId,
      title: article.title,
      status: warnings.length > 0 ? 'review' : 'ready',
      warnings,
    },
  };
}

/** Chunks through included articles one at a time, yielding to the event
 * loop between each so a progress bar and Cancel stay responsive (design
 * spec §5.9). `builderId` is fixed for the whole migration (set on the
 * Import tab, defaulting to detectBuilder's winner) — every article runs
 * read -> resolve media -> writeBlocks through the same reader, using the
 * exact writeBlocks function the settings preview calls, so preview and
 * build output can never disagree. A throw while converting one article
 * is caught and reported as that article failing to build, marked
 * 'review', rather than failing the whole build (design spec §6). */
export async function runBuild(options: RunBuildOptions): Promise<RunBuildResult> {
  const included = options.articles.filter((input) => !input.excluded);
  const exportArticles: ExportArticle[] = [];
  const results: BuildArticleResult[] = [];
  const attachmentIndex = buildAttachmentIndex(options.attachments);

  for (let i = 0; i < included.length; i += 1) {
    if (options.isCancelled?.()) {
      return { wxr: '', articles: results, cancelled: true };
    }

    const input = included[i];
    try {
      const { exportArticle, result } = await buildOneArticle(input, options, attachmentIndex);
      if (exportArticle) exportArticles.push(exportArticle);
      results.push(result);
    } catch (err) {
      results.push({
        postId: input.article.postId,
        title: input.article.title,
        status: 'review',
        warnings: [`Failed to convert this article: ${err instanceof Error ? err.message : String(err)}`],
      });
    }

    options.onProgress?.({ completed: i + 1, total: included.length });
    await yieldToEventLoop();
  }

  const wxr = generateWxr(exportArticles, { siteTitle: options.siteTitle, siteUrl: options.siteUrl });
  return { wxr, articles: results, cancelled: false };
}
