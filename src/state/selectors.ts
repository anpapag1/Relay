import type { AppState, ArticleStatus, DerivedArticle } from './types';
import type { ParsedArticle, TermRef } from '../types/domain';
import { termMappingIdOf } from '../core/mappings/termId';
import { getReader } from '../core/builders';
import { collectMediaRefs } from '../core/build/collectMediaRefs';

export function getArticleId(article: ParsedArticle, index: number): number {
  return article.postId ?? -(index + 1);
}

export function getArticleStatus(
  article: ParsedArticle,
  index: number,
  state: AppState,
): { status: ArticleStatus; reason?: string; warnings: string[] } {
  const id = getArticleId(article, index);
  const override = state.articles[id];

  if (override?.excluded) {
    return {
      status: override.auto ? 'excluded_auto' : 'excluded_manual',
      reason: override.reason || 'Excluded by user',
      warnings: [],
    };
  }

  if (override?.editedHtml != null && override.editedHtml.trim().length > 0) {
    return { status: 'edited', warnings: [] };
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

  const reader = getReader(state.builderId ?? 'plainHtml');
  const { nodes, warnings: readerWarnings } = reader.read({
    contentHtml: article.contentHtml,
    postmeta: article.postmeta,
  });

  const mediaWarnings: string[] = [];
  const refs = collectMediaRefs(nodes);
  for (const ref of refs) {
    const res = state.media.resolved[ref];
    if (res?.outcome === 'unresolved') {
      mediaWarnings.push(res.reason || `Unresolved media reference: ${ref}`);
    } else if (res?.outcome === 'unreachable') {
      mediaWarnings.push(res.reason || `Unreachable media reference: ${ref}`);
    }
  }

  const allWarnings = [...readerWarnings, ...termWarnings, ...mediaWarnings];
  if (allWarnings.length > 0) {
    return { status: 'review', warnings: allWarnings };
  }

  return { status: 'ready', warnings: [] };
}

export function getDerivedArticles(state: AppState): DerivedArticle[] {
  if (!state.source) return [];

  return state.source.articles.map((art, index) => {
    const id = getArticleId(art, index);
    const { status, reason, warnings } = getArticleStatus(art, index, state);
    const override = state.articles[id];

    return {
      ...art,
      id,
      status,
      statusReason: reason,
      warnings,
      isEdited: status === 'edited',
      isExcluded: status.startsWith('excluded'),
      editedHtml: override?.editedHtml,
    };
  });
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
