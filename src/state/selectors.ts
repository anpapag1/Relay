import type { AppState, ArticleStatus, DerivedArticle } from './types';
import type { ParsedArticle, TermRef } from '../types/domain';
import type { IRNode } from '../core/ir/nodes';
import { termMappingIdOf } from '../core/mappings/termId';
import { getReader } from '../core/builders';
import { reviewMessages, infoMessages } from '../core/builders/types';
import { collectMediaRefs, rewriteMediaRefs } from '../core/build/collectMediaRefs';
import { applyTermOverrides, resolveArticleTerms } from '../core/build/resolveTerms';
import { writeBlocks } from '../core/gutenberg/writeBlocks';

export function getArticleId(article: ParsedArticle, index: number): number {
  return article.postId ?? -(index + 1);
}

/** An `attachment:<id>` ref (emitted by e.g. WPBakery's vc_single_image,
 * which only carries an attachment ID, not a URL) can only ever resolve
 * against this export's own <wp:attachment> items — resolveMedia's
 * live-fetch stage has no filename to match it against and always skips
 * it. So unlike a real URL ref (which may just be pending a build's live
 * fetch), a still-missing resolution for one of these is not "not checked
 * yet", it's "will never resolve": the WXR simply never included that
 * media item. */
const ATTACHMENT_REF_RE = /^attachment:(\d+)$/;

/** A file-extension hint that the original content references a photo —
 * used to catch a reader that silently swallowed an image into raw/plain
 * text instead of emitting a real `image`/`gallery` node for it (the exact
 * failure mode a `<strong><a><img></a>caption</strong>`-shaped paragraph
 * used to hit before the reader learned to unwrap inline formatting). */
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp|svg|bmp|avif)(?:[?"'\s>]|$)/i;

/** Recurses into `columns` (the only IR node kind that nests other nodes)
 * to check whether an image ever made it into the parsed tree at all. */
function containsImageNode(nodes: IRNode[]): boolean {
  return nodes.some((node) => {
    if (node.kind === 'image' || node.kind === 'gallery') return true;
    if (node.kind === 'columns') return node.columns.some(containsImageNode);
    return false;
  });
}

export function getArticleStatus(
  article: ParsedArticle,
  index: number,
  state: AppState,
): { status: ArticleStatus; reason?: string; warnings: string[]; infoWarnings: string[]; mediaCount: number } {
  const id = getArticleId(article, index);
  const override = state.articles[id];

  // Computed once, up front, regardless of status: the Articles list's
  // Media column shows this count for every row (excluded/edited included),
  // and reusing this one reader.read() pass avoids a second full parse of
  // the article just to answer "how many media refs does it have".
  const reader = getReader(state.builderId ?? 'plainHtml');
  const { nodes, warnings: readerWarnings } = reader.read({
    contentHtml: article.contentHtml,
    postmeta: article.postmeta,
  });
  const refs = collectMediaRefs(nodes);
  const mediaCount = refs.length;
  const infoWarnings = infoMessages(readerWarnings);

  if (override?.excluded) {
    return {
      status: override.auto ? 'excluded_auto' : 'excluded_manual',
      reason: override.reason || 'Excluded by user',
      warnings: [],
      infoWarnings: [],
      mediaCount,
    };
  }

  if (override?.manualReview) {
    return { status: 'review', reason: 'Flagged for review by user', warnings: [], infoWarnings, mediaCount };
  }

  if (override?.editedHtml != null && override.editedHtml.trim().length > 0) {
    return { status: 'edited', warnings: [], infoWarnings: [], mediaCount };
  }

  const termWarnings: string[] = [];
  const allTargetTerms = Object.values(state.target.tables).flatMap((t) => t.terms);
  for (const term of article.terms) {
    const mapping = state.mappings[termMappingIdOf(term)];
    if (mapping?.excluded) continue;
    const hasValidTarget = mapping?.targetTermIds.some((id) => allTargetTerms.some((t) => t.id === id)) ?? false;
    if (!mapping || mapping.targetTermIds.length === 0 || !hasValidTarget) {
      termWarnings.push(`Unmapped taxonomy term: "${term.name}"`);
    }
  }

  const mediaWarnings: string[] = [];
  for (const ref of refs) {
    const res = state.media.resolved[ref];
    if (res?.outcome === 'unresolved') {
      mediaWarnings.push(res.reason || `Unresolved media reference: ${ref}`);
    } else if (res?.outcome === 'unreachable') {
      mediaWarnings.push(res.reason || `Unreachable media reference: ${ref}`);
    } else if (res?.verified === 'broken') {
      mediaWarnings.push(
        `Image link is broken: ${res.url ?? ref}${res.verifiedReason ? ` (${res.verifiedReason})` : ''}`,
      );
    } else if (!res && ATTACHMENT_REF_RE.test(ref)) {
      mediaWarnings.push(`Image not found in this export: ${ref} — the WXR file has no media item for this attachment ID.`);
    }
  }

  const imageWarnings: string[] = [];
  if (IMAGE_EXTENSION_RE.test(article.contentHtml) && !containsImageNode(nodes)) {
    imageWarnings.push('Original content references an image file, but no image block was produced from it — check for an unconverted image.');
  }

  const allWarnings = [...reviewMessages(readerWarnings), ...termWarnings, ...mediaWarnings, ...imageWarnings];
  if (allWarnings.length > 0) {
    return { status: 'review', warnings: allWarnings, infoWarnings, mediaCount };
  }

  return { status: 'ready', warnings: [], infoWarnings, mediaCount };
}

export function getDerivedArticles(state: AppState): DerivedArticle[] {
  if (!state.source) return [];

  const newTables = Object.values(state.target.tables);

  return state.source.articles.map((art, index) => {
    const id = getArticleId(art, index);
    const { status, reason, warnings, infoWarnings, mediaCount } = getArticleStatus(art, index, state);
    const override = state.articles[id];

    return {
      ...art,
      id,
      status,
      statusReason: reason,
      warnings,
      infoWarnings,
      mediaCount,
      isEdited: status === 'edited',
      isExcluded: status.startsWith('excluded'),
      isManualReview: override?.manualReview ?? false,
      editedHtml: override?.editedHtml,
      title: override?.title ?? art.title,
      postDate: override?.postDate ?? art.postDate,
      postName: override?.newSlug ?? art.postName,
      destinationTerms: applyTermOverrides(
        resolveArticleTerms(art.terms, state.mappings, newTables),
        { categoryIds: override?.categoryIds, tagIds: override?.tagIds },
        newTables,
      ),
    };
  });
}

/** Converts one article's content through the exact same reader ->
 * writeBlocks pipeline runBuild uses, so the Articles preview shows the
 * real post-export markup rather than the untouched original HTML.
 * `state.media.resolved` already carries the synchronous stage-1
 * (`matched-export`) attachment-ID -> URL lookups computed at import time
 * (see resolveStage1Media in reducer.ts), so rewriting refs here needs no
 * live fetch — without it, WPBakery/Divi image shortcodes (which only
 * carry an attachment ID, e.g. `attachment:42`) rendered that literal
 * placeholder as a broken `<img src>` instead of the real old-site URL.
 * The live-probing stage (matched-live/unreachable) only runs during a
 * real build and isn't required for the preview to show a working image.
 * An `editedHtml` override bypasses conversion entirely, mirroring how
 * runBuild treats a manual override. */
export function getArticlePreviewHtml(article: ParsedArticle, editedHtml: string | undefined, state: AppState): { html: string; warnings: string[] } {
  if (editedHtml != null) {
    return { html: editedHtml, warnings: [] };
  }

  const reader = getReader(state.builderId ?? 'plainHtml');
  const { nodes, warnings: readerWarnings } = reader.read({ contentHtml: article.contentHtml, postmeta: article.postmeta });
  const { nodes: rewrittenNodes, warnings: mediaWarnings } = rewriteMediaRefs(nodes, state.media.resolved);

  // An attachment-ID ref only ever resolves against this export's own
  // <wp:attachment> items (resolveMedia's live-fetch stage can't help — it
  // has no filename to match against a numeric ID) — if it's still the raw
  // `attachment:<id>` placeholder here, the image is permanently missing
  // because the WXR simply never included that media item, not because
  // this preview skipped a step a real build would take.
  const stillUnresolved = collectMediaRefs(rewrittenNodes).filter((ref) => ATTACHMENT_REF_RE.test(ref));
  const attachmentWarnings = Array.from(new Set(stillUnresolved)).map(
    (ref) => `Image not found in this export: ${ref} — the WXR file has no media item for this attachment ID.`,
  );

  return {
    html: writeBlocks(rewrittenNodes, state.settings),
    warnings: [...readerWarnings.map((w) => w.message), ...mediaWarnings, ...attachmentWarnings],
  };
}

export function getStatusCounts(derivedArticles: DerivedArticle[]): Record<ArticleStatus | 'total', number> {
  const counts: Record<ArticleStatus | 'total', number> = {
    total: derivedArticles.length,
    ready: 0,
    review: 0,
    edited: 0,
    excluded_auto: 0,
    excluded_manual: 0,
  };

  for (const art of derivedArticles) {
    counts[art.status] = (counts[art.status] ?? 0) + 1;
  }
  return counts;
}

export interface ArticleFilter {
  status?: string;
  search?: string;
  category?: string;
  author?: string;
  sort?: 'title-asc' | 'title-desc' | 'date-asc' | 'date-desc' | 'status';
}

export function getFilteredArticles(derivedArticles: DerivedArticle[], filter: ArticleFilter = {}): DerivedArticle[] {
  let list = [...derivedArticles];

  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'excluded') {
      list = list.filter((a) => a.isExcluded);
    } else {
      list = list.filter((a) => a.status === filter.status);
    }
  }

  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.postName.toLowerCase().includes(q) ||
        a.contentHtml.toLowerCase().includes(q),
    );
  }

  if (filter.category && filter.category !== 'all') {
    list = list.filter((a) => a.terms.some((t) => t.nicename === filter.category || t.name === filter.category));
  }

  if (filter.author && filter.author !== 'all') {
    list = list.filter((a) => a.creator === filter.author);
  }

  if (filter.sort) {
    list.sort((a, b) => {
      switch (filter.sort) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'date-asc':
          return a.postDate.localeCompare(b.postDate);
        case 'date-desc':
          return b.postDate.localeCompare(a.postDate);
        case 'status': {
          const priority: Record<string, number> = { review: 1, ready: 2, edited: 3, excluded_manual: 4, excluded_auto: 5 };
          return (priority[a.status] ?? 99) - (priority[b.status] ?? 99);
        }
        default:
          return 0;
      }
    });
  }

  return list;
}

export function getMappingProgress(state: AppState): {
  total: number;
  mapped: number;
  suggested: number;
  user: number;
  percent: number;
} {
  if (!state.source) return { total: 0, mapped: 0, suggested: 0, user: 0, percent: 0 };

  const uniqueTerms = new Map<string, TermRef>();
  for (const art of state.source.articles) {
    for (const term of art.terms) {
      uniqueTerms.set(termMappingIdOf(term), term);
    }
  }

  const total = uniqueTerms.size;
  if (total === 0) return { total: 0, mapped: 0, suggested: 0, user: 0, percent: 100 };

  let mapped = 0;
  let suggested = 0;
  let user = 0;

  for (const [id] of uniqueTerms) {
    const mapping = state.mappings[id];
    if (mapping && (mapping.excluded || mapping.targetTermIds.length > 0)) {
      mapped += 1;
      if (mapping.origin === 'suggested') suggested += 1;
      if (mapping.origin === 'user') user += 1;
    }
  }

  const percent = Math.round((mapped / total) * 100);
  return { total, mapped, suggested, user, percent };
}

export function getUnmappedTerms(state: AppState): TermRef[] {
  if (!state.source) return [];

  const uniqueTerms = new Map<string, TermRef>();
  for (const art of state.source.articles) {
    for (const term of art.terms) {
      uniqueTerms.set(termMappingIdOf(term), term);
    }
  }

  const unmapped: TermRef[] = [];
  for (const [id, term] of uniqueTerms) {
    const mapping = state.mappings[id];
    if (!mapping || (!mapping.excluded && mapping.targetTermIds.length === 0)) {
      unmapped.push(term);
    }
  }

  return unmapped;
}

export function getMediaStats(
  state: AppState,
  derivedArticles: DerivedArticle[],
): {
  total: number;
  matchedExport: number;
  matchedLive: number;
  unresolved: number;
  unreachable: number;
} {
  const stats = { total: 0, matchedExport: 0, matchedLive: 0, unresolved: 0, unreachable: 0 };
  if (!state.source) return stats;

  const reader = getReader(state.builderId ?? 'plainHtml');
  const allRefs = new Set<string>();

  for (const art of derivedArticles) {
    if (art.isExcluded) continue;
    const { nodes } = reader.read({ contentHtml: art.contentHtml, postmeta: art.postmeta });
    const refs = collectMediaRefs(nodes);
    for (const ref of refs) allRefs.add(ref);
  }

  stats.total = allRefs.size;
  for (const ref of allRefs) {
    const res = state.media.resolved[ref];
    if (res?.outcome === 'matched-export') stats.matchedExport += 1;
    else if (res?.outcome === 'matched-live') stats.matchedLive += 1;
    else if (res?.outcome === 'unresolved') stats.unresolved += 1;
    else if (res?.outcome === 'unreachable') stats.unreachable += 1;
  }

  return stats;
}

/** True when the session holds article-level work that would be lost on a
 * reload: a manual exclude/include, a manual-review flag, or a saved edit.
 * Auto-exclusions are the only overrides `LOAD_SOURCE` writes with
 * `auto: true`; every user action (SET_ARTICLE_EXCLUDED, manual review,
 * save edit) writes one without it. An override emptied back out by
 * `REVERT_ARTICLE_EDIT` (only `editedHtml` removed) counts for nothing.
 * Feeds the `beforeunload` guard so the browser asks before discarding
 * real work. */
export function hasSessionUnsavedWork(state: AppState): boolean {
  return Object.values(state.articles).some(
    (override) =>
      (override.excluded !== undefined && override.auto !== true) ||
      override.manualReview === true ||
      override.editedHtml !== undefined ||
      override.title !== undefined ||
      override.postDate !== undefined ||
      override.newSlug !== undefined ||
      override.categoryIds !== undefined ||
      override.tagIds !== undefined,
  );
}
