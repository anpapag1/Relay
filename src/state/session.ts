import type { ConversionSettings, MediaResolution, TermMapping, TermTable } from '../types/domain';
import type { BuilderId } from '../core/builders/types';
import type { AppState, ArticleOverride } from './types';

export interface SessionBackup {
  version: 1;
  timestamp: string;
  builderId: BuilderId | null;
  builderConfidence: number;
  targetTables: Record<string, TermTable>;
  oldTables?: Record<string, TermTable>;
  mappings: Record<string, TermMapping>;
  settings: ConversionSettings;
  articles: Record<number, ArticleOverride>;
  mediaResolved: Record<string, MediaResolution>;
  liveFetchEnabled: boolean;
}

const LOCAL_STORAGE_KEY = 'relay_session_backup_v1';

/** Normalizes a mapping record coming from a session backup. Older backups
 * used a singular `targetTermId` instead of `targetTermIds`, and had no
 * `excluded` flag — both are defaulted here so an older export loads as
 * "unmapped" rather than crashing the restore. */
function normalizeMappings(raw: Record<string, unknown>): Record<string, TermMapping> {
  const out: Record<string, TermMapping> = {};
  for (const [key, value] of Object.entries(raw)) {
    const m = value as Partial<TermMapping> & { targetTermId?: string | null };
    const targetTermIds = Array.isArray(m.targetTermIds)
      ? m.targetTermIds
      : m.targetTermId
        ? [m.targetTermId]
        : [];
    out[key] = {
      oldDomain: m.oldDomain ?? '',
      oldNicename: m.oldNicename ?? '',
      targetTableId: m.targetTableId ?? null,
      targetTermIds,
      excluded: m.excluded ?? false,
      origin: m.origin ?? 'suggested',
      score: m.score,
    };
  }
  return out;
}

export function createSessionBackup(state: AppState): SessionBackup {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    builderId: state.builderId,
    builderConfidence: state.builderConfidence,
    targetTables: state.target.tables,
    oldTables: state.oldTables,
    mappings: state.mappings,
    settings: state.settings,
    articles: state.articles,
    mediaResolved: state.media.resolved,
    liveFetchEnabled: state.liveFetchEnabled,
  };
}

export function restoreSessionBackup(
  raw: string | unknown,
  currentState: AppState,
): { ok: true; state: Partial<AppState> } | { ok: false; message: string } {
  try {
    const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<SessionBackup>;
    if (!data || typeof data !== 'object' || data.version !== 1) {
      return { ok: false, message: "Couldn't parse that JSON — check the file and try again." };
    }

    const restoredState: Partial<AppState> = {};

    if (data.builderId !== undefined) restoredState.builderId = data.builderId;
    if (data.builderConfidence !== undefined) restoredState.builderConfidence = data.builderConfidence;
    if (data.targetTables) restoredState.target = { tables: data.targetTables };
    if (data.oldTables) restoredState.oldTables = data.oldTables;
    if (data.mappings) restoredState.mappings = normalizeMappings(data.mappings as Record<string, unknown>);
    if (data.settings) restoredState.settings = { ...currentState.settings, ...data.settings };
    if (data.articles) restoredState.articles = data.articles;
    if (data.mediaResolved) {
      restoredState.media = { ...currentState.media, resolved: data.mediaResolved };
    }
    if (data.liveFetchEnabled !== undefined) restoredState.liveFetchEnabled = data.liveFetchEnabled;

    return { ok: true, state: restoredState };
  } catch {
    return { ok: false, message: "Couldn't parse that JSON — check the file and try again." };
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function saveToLocalStorage(state: AppState, debounceMs = 500): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  const doSave = () => {
    try {
      const backup = createSessionBackup(state);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backup));
    } catch {
      // Ignore quota exceeded or localStorage errors in sandboxed environments
    }
  };

  if (debounceMs <= 0) {
    doSave();
  } else {
    debounceTimer = setTimeout(doSave, debounceMs);
  }
}

export function loadFromLocalStorage(currentState: AppState): Partial<AppState> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const item = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!item) return null;
    const res = restoreSessionBackup(item, currentState);
    return res.ok ? res.state : null;
  } catch {
    return null;
  }
}
