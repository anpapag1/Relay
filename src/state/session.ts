import type { ConversionSettings, TermMapping, TermTable } from '../types/domain';
import type { AppState } from './types';

/** Normalizes a mapping record coming from a backup. Older backups
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

/** The user-facing "Export/Import JSON" file on the Import tab — portable
 * across imports: no per-import bookkeeping (version/timestamp), no builder
 * auto-detection result (re-detected fresh from whatever XR is loaded next),
 * and no article overrides/media-resolve cache (both keyed to articles/media
 * refs from THIS specific WXR, meaningless against a different one). Just the
 * portable "site data, mappings, and conversion settings" the button's own
 * label already promises. */
export interface SiteDataBackup {
  targetTables: Record<string, TermTable>;
  oldTables?: Record<string, TermTable>;
  mappings: Record<string, TermMapping>;
  settings: ConversionSettings;
}

export function createSiteDataBackup(state: AppState): SiteDataBackup {
  const settings = { ...state.settings };
  delete settings.fallbackFeaturedImageDataUrl;
  return {
    targetTables: state.target.tables,
    oldTables: state.oldTables,
    mappings: state.mappings,
    settings,
  };
}

export function restoreSiteDataBackup(
  raw: string | unknown,
  currentState: AppState,
): { ok: true; state: Partial<AppState> } | { ok: false; message: string } {
  try {
    const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<SiteDataBackup>;
    if (!data || typeof data !== 'object' || !data.targetTables || !data.mappings || !data.settings) {
      return { ok: false, message: "Couldn't parse that JSON — check the file and try again." };
    }

    const settings = { ...currentState.settings, ...data.settings };
    delete settings.fallbackFeaturedImageDataUrl;

    const restoredState: Partial<AppState> = {
      target: { tables: data.targetTables },
      mappings: normalizeMappings(data.mappings as Record<string, unknown>),
      settings,
    };
    if (data.oldTables) restoredState.oldTables = data.oldTables;

    return { ok: true, state: restoredState };
  } catch {
    return { ok: false, message: "Couldn't parse that JSON — check the file and try again." };
  }
}
