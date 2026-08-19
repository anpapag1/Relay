import type { ConversionSettings, ExportTermRef, MediaResolution, ParseResult, ParsedArticle, TermMapping, TermTable } from '../types/domain';
import type { BuilderId } from '../core/builders/types';
import type { BuildArticleResult } from '../core/build/runBuild';

export type ArticleStatus = 'ready' | 'review' | 'edited' | 'excluded_auto' | 'excluded_manual';

export interface ArticleOverride {
  excluded?: boolean;
  reason?: string;
  editedHtml?: string;
  /** User-edited title; falls back to the parsed title when unset. */
  title?: string;
  /** User-edited publish date; falls back to the parsed date when unset. */
  postDate?: string;
  /** Whether the exclusion was automatically decided at parse time (duplicate slug or empty content). */
  auto?: boolean;
  /** Manually flagged by the user as needing a human look, independent of
   * any warnings the reader/media/term resolution produced on their own. */
  manualReview?: boolean;
}

export interface BuildHistoryEntry {
  id: string;
  date: string;
  articleCount: number;
  sizeBytes: number;
  builderId: BuilderId;
}

export interface AppState {
  ui: {
    activeTab: 'import' | 'mappings' | 'settings' | 'articles' | 'build';
    selectedArticleId: number | null;
    previewMode: 'before' | 'after' | 'edit';
    modals: {
      resetConfirm: boolean;
      sessionRestore: boolean;
      autoMatchConfirm: boolean;
    };
    pickers: {
      destinationTermId: string | null;
    };
    sourceDomain: string | null;
  };
  source: ParseResult | null;
  target: {
    tables: Record<string, TermTable>;
  },
  oldTables: Record<string, TermTable>;
  mappings: Record<string, TermMapping>;
  settings: ConversionSettings;
  articles: Record<number, ArticleOverride>;
  media: {
    resolved: Record<string, MediaResolution>;
    probing: string[];
  };
  build: {
    running: boolean;
    progress: { completed: number; total: number };
    log: string[];
    cancelled: boolean;
    done: boolean;
    /** Set when the build itself threw (distinct from `cancelled`/`done`)
     * — surfaced by the UI instead of a silently-stuck spinner. */
    error: string | null;
    report: {
      wxr: string;
      articles: BuildArticleResult[];
    } | null;
    history: BuildHistoryEntry[];
  };
  builderId: BuilderId | null;
  builderConfidence: number;
}

export interface DerivedArticle extends ParsedArticle {
  id: number;
  status: ArticleStatus;
  statusReason?: string;
  warnings: string[];
  /** Reader notes confirmed to need no human attention (e.g. a known-empty
   * pattern that was automatically and correctly dropped) — shown
   * separately from `warnings` and never affects `status`. */
  infoWarnings: string[];
  /** Count of media references (images, files, embeds) collected from the
   * article's original content via the active builder's reader — shown in
   * the Articles list's Media column. */
  mediaCount: number;
  isEdited: boolean;
  isExcluded: boolean;
  isManualReview: boolean;
  editedHtml?: string;
  /** The article's terms resolved through the mapping table to their
   * new-site destination — what will actually ship in the export, as
   * opposed to `terms`, which stays the raw old-site values. */
  destinationTerms: ExportTermRef[];
}
