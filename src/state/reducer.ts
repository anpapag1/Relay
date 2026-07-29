import type { Action } from './actions';
import type { AppState, ArticleOverride } from './types';
import type { ConversionSettings, MediaResolution, ParsedArticle, ParsedAttachment, TermRef } from '../types/domain';
import { suggestTerms, matchAllTerms } from '../core/mappings/suggestTerms';
import { applyMappings } from '../core/mappings/applyMappings';
import { termMappingId } from '../core/mappings/termId';
import * as mappingTransitions from './mappingTransitions';
import { buildAttachmentIndex, matchAttachment } from '../core/media/attachmentIndex';
import { getReader } from '../core/builders';
import { collectMediaRefs } from '../core/build/collectMediaRefs';

export const DEFAULT_SETTINGS: ConversionSettings = {
  imageSize: 'large',
  imageAlign: 'center',
  autoSpacing: true,
  spacerSize: 30,
  combineConsecutiveImages: false,
  pdfRender: 'embed',
  buttonRender: 'button',
  headingShift: 0,
  linksNewTab: false,
};

export const initialState: AppState = {
  ui: {
    activeTab: 'import',
    selectedArticleId: null,
    previewMode: 'split',
    modals: {
      resetConfirm: false,
      sessionRestore: false,
      autoMatchConfirm: false,
    },
    pickers: {
      destinationTermId: null,
    },
  },
  source: null,
  target: {
    tables: {},
  },
  oldTables: {},
  mappings: {},
  settings: DEFAULT_SETTINGS,
  articles: {},
  media: {
    resolved: {},
    probing: [],
  },
  build: {
    running: false,
    progress: { completed: 0, total: 0 },
    log: [],
    cancelled: false,
    done: false,
    report: null,
    history: [],
  },
  builderId: null,
  builderConfidence: 0,
};

function resolveStage1Media(
  articles: ParsedArticle[],
  attachments: ParsedAttachment[],
  builderId: string,
  existingResolved: Record<string, MediaResolution>,
): Record<string, MediaResolution> {
  const index = buildAttachmentIndex(attachments);
  const resolved = { ...existingResolved };
  const reader = getReader(builderId as any);

  for (const art of articles) {
    const { nodes } = reader.read({ contentHtml: art.contentHtml, postmeta: art.postmeta });
    const refs = collectMediaRefs(nodes);
    for (const ref of refs) {
      if (!resolved[ref]) {
        const matched = matchAttachment(index, ref);
        if (matched) {
          resolved[ref] = { outcome: 'matched-export', url: matched };
        }
      }
    }
  }
  return resolved;
}

function getAllTerms(result: AppState['source'] extends infer R | null ? R : never): any[] {
  if (!result) return [];
  const map = new Map<string, any>();
  for (const [domain, summaries] of Object.entries((result as any).taxonomies || {})) {
    for (const sum of (summaries as any[])) {
      map.set(`${domain}:${sum.nicename}`, { domain, nicename: sum.nicename, name: sum.name });
    }
  }
  for (const art of (result as any).articles || []) {
    for (const term of (art.terms || [])) {
      const key = `${term.domain}:${term.nicename}`;
      if (!map.has(key)) {
        map.set(key, term);
      }
    }
  }
  return Array.from(map.values());
}

export function appReducer(state: AppState = initialState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.tab } };
    case 'SELECT_ARTICLE':
      return { ...state, ui: { ...state.ui, selectedArticleId: action.articleId } };
    case 'SET_PREVIEW_MODE':
      return { ...state, ui: { ...state.ui, previewMode: action.mode } };
    case 'OPEN_MODAL':
      return { ...state, ui: { ...state.ui, modals: { ...state.ui.modals, [action.modal]: true } } };
    case 'CLOSE_MODAL':
      return { ...state, ui: { ...state.ui, modals: { ...state.ui.modals, [action.modal]: false } } };
    case 'LOAD_SOURCE': {
      const { result, defaultBuilder, confidence } = action;

      const articlesOverrides: Record<number, ArticleOverride> = {};
      const seenSlugs = new Set<string>();

      for (let i = 0; i < result.articles.length; i += 1) {
        const art = result.articles[i];
        const id = art.postId ?? -(i + 1);
        const slug = art.postName;
        const stripped = art.contentHtml.replace(/<[^>]*>/g, '').trim();
        const hasRichMedia =
          art.contentHtml.includes('<img') ||
          art.contentHtml.includes('[vc_') ||
          art.contentHtml.includes('[et_pb_') ||
          Object.keys(art.postmeta).some((k) => k.includes('elementor'));

        if (art.status !== 'publish') {
          // Matches the reference tool: only posts that were actually
          // published on the old site are candidates at all — a draft,
          // pending, or private post there has no business going live on
          // the new site just because it happened to be in the export.
          // Auto-excluded (not silently dropped) so it's still visible and
          // reversible in the Articles list, same as the other auto-exclude
          // reasons below.
          articlesOverrides[id] = { excluded: true, reason: `Original post status was "${art.status}", not published`, auto: true };
        } else if (slug && seenSlugs.has(slug)) {
          articlesOverrides[id] = { excluded: true, reason: `Duplicate slug: "${slug}"`, auto: true };
        } else if (!stripped && !hasRichMedia) {
          articlesOverrides[id] = { excluded: true, reason: 'Empty content', auto: true };
        } else {
          if (slug) seenSlugs.add(slug);
        }
      }

      const resolvedMedia = resolveStage1Media(result.articles, result.attachments, defaultBuilder, state.media.resolved);

      return {
        ...state,
        source: result,
        builderId: defaultBuilder,
        builderConfidence: confidence,
        articles: articlesOverrides,
        media: { ...state.media, resolved: resolvedMedia },
      };
    }
    case 'CLEAR_SOURCE':
      return {
        ...state,
        source: null,
        builderId: null,
        builderConfidence: 0,
        oldTables: {},
        mappings: {},
        articles: {},
        build: initialState.build,
      };
    case 'SET_BUILDER': {
      const resolvedMedia = state.source
        ? resolveStage1Media(state.source.articles, state.source.attachments, action.builderId, state.media.resolved)
        : state.media.resolved;
      return {
        ...state,
        builderId: action.builderId,
        media: { ...state.media, resolved: resolvedMedia },
      };
    }
    case 'SET_TARGET_TABLES': {
      const newTablesMap = Object.fromEntries(action.tables.map((t) => [t.id, t]));
      const updatedMappings = state.source ? applyMappings(getAllTerms(state.source), action.tables, state.mappings) : state.mappings;
      return {
        ...state,
        target: { tables: newTablesMap },
        mappings: updatedMappings,
      };
    }
    case 'SET_OLD_TABLES': {
      const oldTablesMap = Object.fromEntries(action.tables.map((t) => [t.id, t]));
      const updatedMappings = state.source
        ? applyMappings(getAllTerms(state.source), Object.values(state.target.tables), state.mappings)
        : state.mappings;
      return {
        ...state,
        oldTables: oldTablesMap,
        mappings: updatedMappings,
      };
    }
    case 'SET_TERM_ACTION': {
      const key = termMappingId(action.oldDomain, action.oldNicename);
      const existing = state.mappings[key];
      return {
        ...state,
        mappings: {
          ...state.mappings,
          [key]: mappingTransitions.setTargetTable(existing, action.oldDomain, action.oldNicename, action.targetTableId),
        },
      };
    }
    case 'ADD_TERM_DESTINATION': {
      const key = termMappingId(action.oldDomain, action.oldNicename);
      const existing = state.mappings[key];
      const next = mappingTransitions.addDestination(existing, action.targetTermId);
      if (!next || next === existing) return state;
      return { ...state, mappings: { ...state.mappings, [key]: next } };
    }
    case 'REMOVE_TERM_DESTINATION': {
      const key = termMappingId(action.oldDomain, action.oldNicename);
      const existing = state.mappings[key];
      const next = mappingTransitions.removeDestination(existing, action.targetTermId);
      if (!next) return state;
      return { ...state, mappings: { ...state.mappings, [key]: next } };
    }
    case 'SET_TERM_EXCLUDED': {
      const key = termMappingId(action.oldDomain, action.oldNicename);
      const existing = state.mappings[key];
      return {
        ...state,
        mappings: {
          ...state.mappings,
          [key]: mappingTransitions.setExcluded(existing, action.oldDomain, action.oldNicename, action.excluded),
        },
      };
    }
    case 'SET_DESTINATION_PICKER':
      return { ...state, ui: { ...state.ui, pickers: { ...state.ui.pickers, destinationTermId: action.termId } } };
    case 'CLEAR_ALL_MAPPINGS':
      return { ...state, mappings: {} };
    case 'RESET_MAPPINGS': {
      const reset = state.source ? suggestTerms(getAllTerms(state.source), Object.values(state.target.tables)) : {};
      return { ...state, mappings: reset };
    }
    case 'AUTO_MATCH_MAPPINGS': {
      const oldTerms: TermRef[] = Object.values(state.oldTables).flatMap((table) =>
        table.terms.map((term) => ({ domain: table.id, nicename: term.slug || term.id, name: term.name })),
      );
      const matched = matchAllTerms(oldTerms, Object.values(state.target.tables));
      return { ...state, mappings: matched };
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'SET_ARTICLE_EXCLUDED': {
      const prev = state.articles[action.articleId] ?? {};
      return {
        ...state,
        articles: {
          ...state.articles,
          [action.articleId]: {
            ...prev,
            excluded: action.excluded,
            reason: action.excluded ? 'Excluded by user' : undefined,
            auto: false,
          },
        },
      };
    }
    case 'SAVE_ARTICLE_EDIT': {
      const prev = state.articles[action.articleId] ?? {};
      return {
        ...state,
        articles: {
          ...state.articles,
          [action.articleId]: {
            ...prev,
            editedHtml: action.editedHtml,
          },
        },
      };
    }
    case 'REVERT_ARTICLE_EDIT': {
      const prev = state.articles[action.articleId] ?? {};
      const next = { ...prev };
      delete next.editedHtml;
      return {
        ...state,
        articles: {
          ...state.articles,
          [action.articleId]: next,
        },
      };
    }
    case 'SET_MEDIA_RESOLUTIONS':
      return {
        ...state,
        media: {
          ...state.media,
          resolved: { ...state.media.resolved, ...action.resolutions },
        },
      };
    case 'START_BUILD':
      return {
        ...state,
        build: {
          ...state.build,
          running: true,
          progress: { completed: 0, total: 0 },
          log: ['Build started...'],
          cancelled: false,
          done: false,
          report: null,
        },
      };
    case 'BUILD_PROGRESS':
      return {
        ...state,
        build: {
          ...state.build,
          progress: { completed: action.completed, total: action.total },
          log: action.logLine ? [...state.build.log, action.logLine] : state.build.log,
        },
      };
    case 'BUILD_COMPLETE':
      return {
        ...state,
        build: {
          ...state.build,
          running: false,
          done: true,
          report: action.report,
          history: [action.historyEntry, ...state.build.history],
        },
      };
    case 'CANCEL_BUILD':
      return {
        ...state,
        build: {
          ...state.build,
          running: false,
          cancelled: true,
          log: [...state.build.log, 'Build cancelled by user.'],
        },
      };
    case 'RESTORE_SESSION':
      return {
        ...state,
        ...action.state,
      };
    case 'RESET_ALL':
      return initialState;
    default:
      return state;
  }
}
