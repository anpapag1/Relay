import type { ConversionSettings, MediaResolution, ParseResult, ParsedArticle, TermMapping, TermTable } from '../types/domain';
import type { BuilderId } from '../core/builders/types';
import type { BuildArticleResult } from '../core/build/runBuild';

export type ArticleStatus = 'ready' | 'review' | 'edited' | 'excluded_auto' | 'excluded_manual';

export interface ArticleOverride {
  excluded?: boolean;
  reason?: string;
  editedHtml?: string;
  /** Whether the exclusion was automatically decided at parse time (duplicate slug or empty content). */
  auto?: boolean;
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
    previewMode: 'before' | 'after' | 'split';
    modals: {
      resetConfirm: boolean;
      sessionRestore: boolean;
    };
    pickers: {
      destinationTermId: string | null;
    };
  };
  source: ParseResult | null;
  target: {
    tables: Record<string, TermTable>;
  };
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
    report: {
      wxr: string;
      articles: BuildArticleResult[];
    } | null;
    history: BuildHistoryEntry[];
  };
  builderId: BuilderId | null;
  builderConfidence: number;
  liveFetchEnabled: boolean;
}

export interface DerivedArticle extends ParsedArticle {
  id: number;
  status: ArticleStatus;
  statusReason?: string;
  warnings: string[];
  isEdited: boolean;
  isExcluded: boolean;
  editedHtml?: string;
}
