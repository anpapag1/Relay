import type { ConversionSettings, ExportArticle, ParsedArticle, ParsedAttachment, TermMapping, TermTable } from '../../types/domain';
import type { BuilderId } from '../builders/types';
import { getReader } from '../builders';
import { writeBlocks } from '../gutenberg/writeBlocks';
import { generateWxr } from '../wxr/generateWxr';
import { resolveMediaRefs } from '../media/resolveMedia';
import { resolveFeaturedImage } from '../media/resolveFeaturedImage';
import type { FetchLike } from '../media/mediaClient';
import { collectMediaRefs, rewriteMediaRefs } from './collectMediaRefs';
import { resolveArticleTerms } from './resolveTerms';

export interface BuildArticleInput {
  article: ParsedArticle;
  excluded: boolean;
  /** Already-converted Gutenberg markup from the article drawer. When
   * set, the reader/writer are bypassed entirely and this is emitted
   * as-is (design spec §4). */
  editedHtml?: string;
}

export type ArticleBuildStatus = 'ready' | 'review';

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
  liveFetchEnabled: boolean;
  fetchImpl: FetchLike;
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
): ExportArticle {
  return {
    postId: article.postId ?? 0,
    title: article.title,
    link: article.link,
    postDate: article.postDate,
    postName: article.postName || undefined,
    authorLogin: article.creator || 'admin',
    contentHtml,
    terms,
    featuredAttachmentUrl,
  };
}

async function buildOneArticle(
  input: BuildArticleInput,
  options: RunBuildOptions,
): Promise<{ exportArticle: ExportArticle; result: BuildArticleResult }> {
  const { article } = input;
  const terms = resolveArticleTerms(article.terms, options.mappings, options.newTables);
  const featuredAttachmentUrl = await resolveFeaturedImage(article, options.attachments, {
    liveFetchEnabled: options.liveFetchEnabled,
    fetchImpl: options.fetchImpl,
  });

  if (input.editedHtml != null) {
    return {
      exportArticle: toExportArticle(article, input.editedHtml, terms, featuredAttachmentUrl),
      result: { postId: article.postId, title: article.title, status: 'ready', warnings: [] },
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
    liveFetchEnabled: options.liveFetchEnabled,
    fetchImpl: options.fetchImpl,
  });
  const { nodes: rewrittenNodes, warnings: mediaWarnings } = rewriteMediaRefs(nodes, resolved);

  const contentHtml = writeBlocks(rewrittenNodes, options.settings);
  const warnings = [...readerWarnings, ...mediaWarnings];

  return {
    exportArticle: toExportArticle(article, contentHtml, terms, featuredAttachmentUrl),
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

  for (let i = 0; i < included.length; i += 1) {
    if (options.isCancelled?.()) {
      return { wxr: '', articles: results, cancelled: true };
    }

    const input = included[i];
    try {
      const { exportArticle, result } = await buildOneArticle(input, options);
      exportArticles.push(exportArticle);
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
