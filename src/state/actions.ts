import type { ConversionSettings, MediaResolution, ParseResult, TermTable } from '../types/domain';
import type { BuilderId } from '../core/builders/types';
import type { BuildArticleResult } from '../core/build/runBuild';
import type { AppState, BuildHistoryEntry } from './types';

export type Action =
  | { type: 'SET_ACTIVE_TAB'; tab: AppState['ui']['activeTab'] }
  | { type: 'SELECT_ARTICLE'; articleId: number | null }
  | { type: 'SET_PREVIEW_MODE'; mode: AppState['ui']['previewMode'] }
  | { type: 'OPEN_MODAL'; modal: keyof AppState['ui']['modals'] }
  | { type: 'CLOSE_MODAL'; modal: keyof AppState['ui']['modals'] }
  | { type: 'SET_SOURCE_DOMAIN'; domain: string }
  | { type: 'SET_ONBOARDING_STEP'; step: number | null }
  | { type: 'LOAD_SOURCE'; result: ParseResult; defaultBuilder: BuilderId; confidence: number }
  | { type: 'CLEAR_SOURCE' }
  | { type: 'SET_BUILDER'; builderId: BuilderId }
  | { type: 'SET_TARGET_TABLES'; tables: TermTable[] }
  | { type: 'SET_OLD_TABLES'; tables: TermTable[] }
  | { type: 'SET_TERM_ACTION'; oldDomain: string; oldNicename: string; targetTableId: string | null }
  | { type: 'ADD_TERM_DESTINATION'; oldDomain: string; oldNicename: string; targetTermId: string }
  | { type: 'REMOVE_TERM_DESTINATION'; oldDomain: string; oldNicename: string; targetTermId: string }
  | { type: 'SET_TERM_EXCLUDED'; oldDomain: string; oldNicename: string; excluded: boolean }
  | { type: 'SET_DESTINATION_PICKER'; termId: string | null }
  | { type: 'CLEAR_ALL_MAPPINGS' }
  | { type: 'RESET_MAPPINGS' }
  | { type: 'AUTO_MATCH_MAPPINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ConversionSettings> }
  | { type: 'SET_ARTICLE_EXCLUDED'; articleId: number; excluded: boolean }
  | { type: 'SET_ARTICLE_MANUAL_REVIEW'; articleId: number; manualReview: boolean }
  | { type: 'SAVE_ARTICLE_EDIT'; articleId: number; editedHtml: string }
  | { type: 'REVERT_ARTICLE_EDIT'; articleId: number }
  | { type: 'RESET_ARTICLE'; articleId: number }
  | {
      type: 'UPDATE_ARTICLE_METADATA';
      articleId: number;
      title?: string;
      postDate?: string;
      /** Override for the exported `wp:post_name` (new-site slug). */
      newSlug?: string;
      /** Destination term IDs (from the target category table) that replace
       * the article's mapped categories on export. */
      categoryIds?: string[];
      /** Destination term IDs (from the target tag table) that replace the
       * article's mapped tags on export. */
      tagIds?: string[];
    }
  | { type: 'SET_MEDIA_RESOLUTIONS'; resolutions: Record<string, MediaResolution> }
  | { type: 'START_BUILD' }
  | { type: 'BUILD_PROGRESS'; completed: number; total: number; logLine?: string }
  | { type: 'BUILD_COMPLETE'; report: { wxr: string; articles: BuildArticleResult[] }; historyEntry: BuildHistoryEntry }
  | { type: 'CANCEL_BUILD' }
  | { type: 'BUILD_FAILED'; message: string }
  | { type: 'RESTORE_SESSION'; state: Partial<AppState> }
  | { type: 'RESET_ALL' };

export const actions = {
  setActiveTab: (tab: AppState['ui']['activeTab']): Action => ({ type: 'SET_ACTIVE_TAB', tab }),
  selectArticle: (articleId: number | null): Action => ({ type: 'SELECT_ARTICLE', articleId }),
  setPreviewMode: (mode: AppState['ui']['previewMode']): Action => ({ type: 'SET_PREVIEW_MODE', mode }),
  openModal: (modal: keyof AppState['ui']['modals']): Action => ({ type: 'OPEN_MODAL', modal }),
  closeModal: (modal: keyof AppState['ui']['modals']): Action => ({ type: 'CLOSE_MODAL', modal }),
  setSourceDomain: (domain: string): Action => ({ type: 'SET_SOURCE_DOMAIN', domain }),
  setOnboardingStep: (step: number | null): Action => ({ type: 'SET_ONBOARDING_STEP', step }),
  loadSource: (result: ParseResult, defaultBuilder: BuilderId, confidence: number): Action => ({
    type: 'LOAD_SOURCE',
    result,
    defaultBuilder,
    confidence,
  }),
  clearSource: (): Action => ({ type: 'CLEAR_SOURCE' }),
  setBuilder: (builderId: BuilderId): Action => ({ type: 'SET_BUILDER', builderId }),
  setTargetTables: (tables: TermTable[]): Action => ({ type: 'SET_TARGET_TABLES', tables }),
  setOldTables: (tables: TermTable[]): Action => ({ type: 'SET_OLD_TABLES', tables }),
  setTermAction: (oldDomain: string, oldNicename: string, targetTableId: string | null): Action => ({
    type: 'SET_TERM_ACTION',
    oldDomain,
    oldNicename,
    targetTableId,
  }),
  addTermDestination: (oldDomain: string, oldNicename: string, targetTermId: string): Action => ({
    type: 'ADD_TERM_DESTINATION',
    oldDomain,
    oldNicename,
    targetTermId,
  }),
  removeTermDestination: (oldDomain: string, oldNicename: string, targetTermId: string): Action => ({
    type: 'REMOVE_TERM_DESTINATION',
    oldDomain,
    oldNicename,
    targetTermId,
  }),
  setTermExcluded: (oldDomain: string, oldNicename: string, excluded: boolean): Action => ({
    type: 'SET_TERM_EXCLUDED',
    oldDomain,
    oldNicename,
    excluded,
  }),
  setDestinationPicker: (termId: string | null): Action => ({ type: 'SET_DESTINATION_PICKER', termId }),
  clearAllMappings: (): Action => ({ type: 'CLEAR_ALL_MAPPINGS' }),
  resetMappings: (): Action => ({ type: 'RESET_MAPPINGS' }),
  autoMatchMappings: (): Action => ({ type: 'AUTO_MATCH_MAPPINGS' }),
  updateSettings: (settings: Partial<ConversionSettings>): Action => ({ type: 'UPDATE_SETTINGS', settings }),
  setArticleExcluded: (articleId: number, excluded: boolean): Action => ({ type: 'SET_ARTICLE_EXCLUDED', articleId, excluded }),
  setArticleManualReview: (articleId: number, manualReview: boolean): Action => ({ type: 'SET_ARTICLE_MANUAL_REVIEW', articleId, manualReview }),
  saveArticleEdit: (articleId: number, editedHtml: string): Action => ({ type: 'SAVE_ARTICLE_EDIT', articleId, editedHtml }),
  revertArticleEdit: (articleId: number): Action => ({ type: 'REVERT_ARTICLE_EDIT', articleId }),
  resetArticle: (articleId: number): Action => ({ type: 'RESET_ARTICLE', articleId }),
  updateArticleMetadata: (
    articleId: number,
    metadata: { title?: string; postDate?: string; newSlug?: string; categoryIds?: string[]; tagIds?: string[] },
  ): Action => ({
    type: 'UPDATE_ARTICLE_METADATA',
    articleId,
    title: metadata.title,
    postDate: metadata.postDate,
    newSlug: metadata.newSlug,
    categoryIds: metadata.categoryIds,
    tagIds: metadata.tagIds,
  }),
  setMediaResolutions: (resolutions: Record<string, MediaResolution>): Action => ({ type: 'SET_MEDIA_RESOLUTIONS', resolutions }),
  startBuild: (): Action => ({ type: 'START_BUILD' }),
  buildProgress: (completed: number, total: number, logLine?: string): Action => ({ type: 'BUILD_PROGRESS', completed, total, logLine }),
  buildComplete: (report: { wxr: string; articles: BuildArticleResult[] }, historyEntry: BuildHistoryEntry): Action => ({
    type: 'BUILD_COMPLETE',
    report,
    historyEntry,
  }),
  cancelBuild: (): Action => ({ type: 'CANCEL_BUILD' }),
  buildFailed: (message: string): Action => ({ type: 'BUILD_FAILED', message }),
  restoreSession: (state: Partial<AppState>): Action => ({ type: 'RESTORE_SESSION', state }),
  resetAll: (): Action => ({ type: 'RESET_ALL' }),
};
